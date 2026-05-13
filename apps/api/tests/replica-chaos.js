/**
 * 트래픽이 흐르는 중에 API 복제본 4대 가운데 한 대를 강제로 종료하는 부하 테스트입니다.
 * 세 가지를 함께 검증합니다.
 *
 * - NGINX가 `proxy_next_upstream`으로 살아 있는 복제본에 우회하는가
 * - 재시작한 복제본이 다시 응답하는가
 * - 장애 복구 구간 동안 사용자에게 5xx가 거의 보이지 않는가
 *
 * 테스트 시작 시점을 기준으로 단계는 다음 순서로 진행됩니다.
 * - 0~30초: 복제본 4대가 모두 살아 있는 상태에서 워밍업
 * - 30초: 대상 복제본을 `docker kill`로 종료
 * - 30~60초: 복제본 3대만으로 트래픽 유지
 * - 60초: 대상 복제본을 `docker start`로 다시 시작
 * - 60~90초: 복제본이 healthy가 될 때까지 기다리며 트래픽 유지
 * - 90~150초: 복구 후 트래픽. 복제본 4대가 모두 응답해야 함
 *
 * 전체 구간 합산 에러율이 1%를 넘거나, 재시작 뒤 60초 안에 healthy가 되지 않거나,
 * 복구 후 구간에서 응답한 복제본 수가 4보다 적으면 실패로 봅니다.
 */

const http = require('http')
const { execSync } = require('child_process')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const KILL_AT_MS = Number(process.env.CHAOS_KILL_AT_MS || 30_000)
const RESTART_AFTER_MS = Number(process.env.CHAOS_RESTART_AFTER_MS || 30_000)
const POST_RECOVERY_MS = Number(process.env.CHAOS_POST_RECOVERY_MS || 60_000)
const HEALTH_TIMEOUT_MS = Number(process.env.CHAOS_HEALTH_TIMEOUT_MS || 60_000)
const PARALLELISM = Number(process.env.CHAOS_PARALLELISM || 8)

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
}

function post(path, body) {
    const url = new URL(path, SERVER_URL)
    const payload = JSON.stringify(body)
    const agent = new http.Agent({ keepAlive: false })
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                agent,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(payload)
                }
            },
            (res) => {
                const chunks = []
                res.on('data', (c) => chunks.push(c))
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        replicaId: res.headers['x-replica-id'],
                        body: Buffer.concat(chunks).toString('utf8')
                    })
                    agent.destroy()
                })
            }
        )
        req.on('error', reject)
        req.write(payload)
        req.end()
    })
}

function dockerReplicaIds() {
    const out = execSync('docker compose ps -q api', { encoding: 'utf8' }).trim()
    return out ? out.split('\n') : []
}

function inspectHealth(containerId) {
    try {
        return execSync(`docker inspect --format '{{.State.Health.Status}}' ${containerId}`, {
            encoding: 'utf8'
        }).trim()
    } catch {
        return 'missing'
    }
}

function bucketFor(state) {
    const b = state.byPhase[state.phase] ?? { byStatus: {}, replicas: {}, total: 0 }
    state.byPhase[state.phase] = b
    return b
}

async function trafficWorker(workerId, state) {
    while (!state.stop) {
        const email = `chaos.${Date.now()}.${workerId}.${Math.random().toString(36).slice(2)}@example.com`
        try {
            const r = await post('/users', {
                name: 'chaos',
                birthDate: '1990-01-01T00:00:00.000Z',
                email,
                password: 'chaospassword'
            })
            const b = bucketFor(state)
            b.total++
            b.byStatus[r.status] = (b.byStatus[r.status] || 0) + 1
            if (r.replicaId) b.replicas[r.replicaId] = (b.replicas[r.replicaId] || 0) + 1
        } catch {
            const b = bucketFor(state)
            b.total++
            b.byStatus['err'] = (b.byStatus['err'] || 0) + 1
        }
    }
}

function summarize(label, bucket) {
    if (!bucket || !bucket.total) return `${label}: no traffic`
    const status = Object.entries(bucket.byStatus)
        .map(([s, c]) => `${s}=${c}`)
        .join(' ')
    const replicas = Object.keys(bucket.replicas).length
    return `${label}: total=${bucket.total} replicas=${replicas} | ${status}`
}

async function main() {
    const replicas = dockerReplicaIds()
    if (replicas.length < 4) {
        throw new Error(`expected 4 app replicas, got ${replicas.length}: ${replicas.join(',')}`)
    }
    const target = replicas[Math.floor(Math.random() * replicas.length)]
    console.log(`[chaos] target=${target.slice(0, 12)} alive=${replicas.length}`)

    const state = { stop: false, phase: 'warmup', byPhase: {} }
    const workers = Array.from({ length: PARALLELISM }, (_, i) => trafficWorker(i, state))

    await sleep(KILL_AT_MS)

    state.phase = 'after-kill'
    console.log(`[chaos] t=${KILL_AT_MS}ms killing ${target.slice(0, 12)}`)
    execSync(`docker kill ${target}`)
    await sleep(RESTART_AFTER_MS)

    state.phase = 'after-restart'
    console.log(`[chaos] t=${KILL_AT_MS + RESTART_AFTER_MS}ms restarting ${target.slice(0, 12)}`)
    execSync(`docker start ${target}`)

    const healStart = Date.now()
    const healDeadline = healStart + HEALTH_TIMEOUT_MS
    let healthyAt = null
    while (Date.now() < healDeadline) {
        if (inspectHealth(target) === 'healthy') {
            healthyAt = Date.now()
            break
        }
        await sleep(1000)
    }
    if (!healthyAt) {
        state.stop = true
        await Promise.all(workers)
        throw new Error(`replica did not become healthy within ${HEALTH_TIMEOUT_MS}ms`)
    }
    console.log(`[chaos] healthy after ${Math.round((healthyAt - healStart) / 1000)}s`)

    state.phase = 'recovered'
    await sleep(POST_RECOVERY_MS)

    state.stop = true
    await Promise.all(workers)

    const phases = ['warmup', 'after-kill', 'after-restart', 'recovered']
    for (const p of phases) console.log(`[chaos] ${summarize(p, state.byPhase[p])}`)

    const allByStatus = {}
    const allReplicas = new Set()
    for (const p of phases) {
        const b = state.byPhase[p]
        if (!b) continue
        for (const [s, c] of Object.entries(b.byStatus)) allByStatus[s] = (allByStatus[s] || 0) + c
        for (const r of Object.keys(b.replicas)) allReplicas.add(r)
    }
    const total = Object.values(allByStatus).reduce((a, b) => a + b, 0)
    const errs = Object.entries(allByStatus)
        .filter(([s]) => s === 'err' || (typeof s === 'string' && /^5\d\d$/.test(s)))
        .reduce((a, [, c]) => a + c, 0)
    const rate = total ? errs / total : 0
    console.log(`[chaos] total=${total} 5xx-or-err=${errs} (${(rate * 100).toFixed(3)}%)`)

    if (rate > 0.01) {
        throw new Error(
            `error rate ${(rate * 100).toFixed(3)}% exceeds 1% — nginx failover may not be working`
        )
    }
    const recoveredReplicas = Object.keys(state.byPhase.recovered?.replicas || {}).length
    if (recoveredReplicas < 4) {
        throw new Error(
            `post-recovery: only ${recoveredReplicas} replicas served — restarted replica did not rejoin`
        )
    }
    if (allReplicas.size < 4) {
        throw new Error(`overall: only ${allReplicas.size} distinct replicas served`)
    }
    console.log('[chaos] PASS')
}

main().catch((err) => {
    console.error('[chaos] error:', err)
    process.exit(1)
})
