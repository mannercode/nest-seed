// Distributed stress test: replica chaos — kill 1 of 4 app replicas
// mid-traffic and verify (a) nginx routes around it via
// proxy_next_upstream, (b) the killed replica rejoins after restart and
// serves again, (c) no user-facing 5xx during the failover window.
//
// Phases (timed from test start):
//   0-30s   warmup traffic with all 4 replicas alive
//   30s     docker kill <target>
//   30-60s  traffic continues with 3 replicas
//   60s     docker start <target>
//   60-90s  wait for target healthcheck, traffic still flowing
//   90-150s post-recovery traffic; all 4 replicas must serve
//
// Fails if: error rate >1% across all phases (nginx retries should mask
// transient kill-window failures), the killed replica does not become
// healthy within 60s of restart, or fewer than 4 replicas serve in the
// post-recovery window.

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
    const out = execSync('docker compose ps -q app', { encoding: 'utf8' }).trim()
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
