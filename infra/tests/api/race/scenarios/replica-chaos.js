/**
 * 요청을 보내는 중 복제본 하나를 종료·재시작해 NGINX가 남은 복제본으로 요청을 보내는지와 재시작 후 복구를 검증한다.
 * 장애 구간에 시작한 가입이 성공해야 한다. 전체 전송 오류와 5xx 응답의 비율은 1% 이하여야 하고 복구 구간에는 설정한 복제본이 모두 응답해야 한다.
 */

import { execFile, execSync } from 'node:child_process'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { readPositiveInt, request, secureRandomHex, secureRandomIndex } from '../race-common.js'

const KILL_AT_MS = readPositiveInt('CHAOS_KILL_AT_MS', 30_000)
const RESTART_AFTER_MS = readPositiveInt('CHAOS_RESTART_AFTER_MS', 30_000)
const POST_RECOVERY_MS = readPositiveInt('CHAOS_POST_RECOVERY_MS', 60_000)
const HEALTH_TIMEOUT_MS = readPositiveInt('CHAOS_HEALTH_TIMEOUT_MS', 60_000)
const PARALLELISM = readPositiveInt('CHAOS_PARALLELISM', 8)
const execFileAsync = promisify(execFile)

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
}

function dockerReplicaIds() {
    const out = execSync('docker compose --profile replicas ps -q replica-api', {
        encoding: 'utf8'
    }).trim()
    return out ? out.split('\n') : []
}

async function inspectHealth(containerId) {
    const { stdout } = await execFileAsync('docker', [
        'inspect',
        '--format',
        '{{.State.Health.Status}}',
        containerId
    ])
    return stdout.trim()
}

function beginPhase(state, name) {
    const now = performance.now()
    if (state.phase) state.byPhase[state.phase].end = now
    state.phase = name
    state.byPhase[name] = {
        start: now,
        lastSuccess: now,
        maxGap: 0,
        latencies: [],
        byStatus: {},
        replicas: {},
        total: 0
    }
}

async function trafficWorker(workerId, state) {
    while (!state.stop) {
        const startedPhase = state.phase
        const startedAt = performance.now()
        const email = `chaos.${workerId}.${secureRandomHex()}@example.com`
        let status = 'err'
        let replicaId
        try {
            const r = await request('POST', '/users', {
                body: {
                    name: 'chaos',
                    birthDate: '1990-01-01',
                    email,
                    password: 'chaos password 123'
                }
            })
            status = r.status
            replicaId = r.replicaId
        } catch {
            // 소켓과 전송 오류도 해당 구간의 요청 수와 오류율에 포함한다.
        }
        const completedAt = performance.now()
        const bucket = state.byPhase[state.phase]
        bucket.total++
        bucket.latencies.push(completedAt - startedAt)
        bucket.byStatus[status] = (bucket.byStatus[status] ?? 0) + 1
        if (status === 201) {
            bucket.maxGap = Math.max(bucket.maxGap, completedAt - bucket.lastSuccess)
            bucket.lastSuccess = completedAt
            if (startedPhase === state.phase && replicaId) {
                bucket.replicas[replicaId] = (bucket.replicas[replicaId] ?? 0) + 1
            }
        }
    }
}

function summarize(label, bucket) {
    const seconds = (bucket.end - bucket.start) / 1000
    const maxGap = Math.max(bucket.maxGap, bucket.end - bucket.lastSuccess)
    bucket.latencies.sort((a, b) => a - b)
    const p95 = bucket.latencies[Math.ceil(bucket.total * 0.95) - 1]
    const status = Object.entries(bucket.byStatus)
        .map(([s, c]) => `${s}=${c}`)
        .join(' ')
    const replicas = Object.keys(bucket.replicas).length
    return `${label}: total=${bucket.total} replicas=${replicas} completed/s=${(bucket.total / seconds).toFixed(2)} p95_ms=${p95?.toFixed(1) ?? 'n/a'} max_signup_gap_ms=${maxGap.toFixed(1)} | ${status}`
}

test('복제본 하나를 재시작하면 중단 중에도 가입에 성공하고 전체 오류율은 1% 이하이며 복구 후 모든 복제본이 응답한다', async () => {
    const { services } = JSON.parse(
        execSync('docker compose --profile replicas config --format json', { encoding: 'utf8' })
    )
    const expectedReplicas = services['replica-api'].deploy.replicas
    const replicas = dockerReplicaIds()
    if (expectedReplicas < 2 || replicas.length !== expectedReplicas) {
        throw new Error(
            `failover requires at least 2 replicas: configured ${expectedReplicas}, running ${replicas.length}`
        )
    }
    const target = replicas[secureRandomIndex(replicas.length)]
    console.log(`[chaos] target=${target.slice(0, 12)} alive=${replicas.length}`)

    const state = { stop: false, byPhase: {} }
    beginPhase(state, 'warmup')
    const workers = Array.from({ length: PARALLELISM }, (_, i) => trafficWorker(i, state))

    try {
        await sleep(KILL_AT_MS)

        console.log(`[chaos] t=${KILL_AT_MS}ms killing ${target.slice(0, 12)}`)
        await execFileAsync('docker', ['kill', target])
        beginPhase(state, 'after-kill')
        await sleep(RESTART_AFTER_MS)

        beginPhase(state, 'after-restart')
        console.log(
            `[chaos] t=${KILL_AT_MS + RESTART_AFTER_MS}ms restarting ${target.slice(0, 12)}`
        )
        await execFileAsync('docker', ['start', target])

        const healStart = performance.now()
        const healDeadline = healStart + HEALTH_TIMEOUT_MS
        let healthyAt = null
        while (performance.now() < healDeadline) {
            if ((await inspectHealth(target)) === 'healthy') {
                healthyAt = performance.now()
                break
            }
            await sleep(1000)
        }
        if (healthyAt === null) {
            throw new Error(`replica did not become healthy within ${HEALTH_TIMEOUT_MS}ms`)
        }
        console.log(`[chaos] healthy after ${Math.round((healthyAt - healStart) / 1000)}s`)

        beginPhase(state, 'recovered')
        await sleep(POST_RECOVERY_MS)
    } finally {
        state.stop = true
        await Promise.all(workers)
        state.byPhase[state.phase].end = performance.now()
    }

    const phases = ['warmup', 'after-kill', 'after-restart', 'recovered']
    for (const p of phases) console.log(`[chaos] ${summarize(p, state.byPhase[p])}`)

    if (!Object.keys(state.byPhase['after-kill']?.replicas ?? {}).length) {
        throw new Error('No replica completed a signup started during the outage')
    }
    const allByStatus = {}
    const allReplicas = new Set()
    for (const p of phases) {
        const b = state.byPhase[p]
        if (!b) continue
        for (const [s, c] of Object.entries(b.byStatus)) allByStatus[s] = (allByStatus[s] || 0) + c
        for (const r of Object.keys(b.replicas)) allReplicas.add(r)
    }
    const total = Object.values(allByStatus).reduce((a, b) => a + b, 0)
    const unexpected = Object.entries(allByStatus).filter(
        ([s]) => s !== '201' && s !== 'err' && !/^5\d\d$/.test(s)
    )
    if (unexpected.length > 0) {
        throw new Error(`unexpected signup responses: ${JSON.stringify(unexpected)}`)
    }
    const errs = Object.entries(allByStatus)
        .filter(([s]) => s === 'err' || (typeof s === 'string' && /^5\d\d$/.test(s)))
        .reduce((a, [, c]) => a + c, 0)
    const rate = errs / total
    console.log(`[chaos] total=${total} 5xx-or-err=${errs} (${(rate * 100).toFixed(3)}%)`)

    if (rate > 0.01) {
        throw new Error(
            `error rate ${(rate * 100).toFixed(3)}% exceeds 1% — nginx failover may not be working`
        )
    }
    const recoveredReplicas = Object.keys(state.byPhase.recovered?.replicas || {}).length
    if (recoveredReplicas !== expectedReplicas) {
        throw new Error(
            `post-recovery: only ${recoveredReplicas} replicas served — restarted replica did not rejoin`
        )
    }
    if (allReplicas.size !== expectedReplicas) {
        throw new Error(`overall: only ${allReplicas.size} distinct replicas served`)
    }
    console.log('[chaos] PASS')
})
