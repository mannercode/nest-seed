// `/users/refresh` 경로에 지속 부하를 걸어 측정하는 하네스입니다.
//
// 이 경로는 호출마다 Redis를 두 번 칩니다. 이전 refresh 토큰을 GET으로 읽고,
// 새 access·refresh JWT를 만들어 TTL이 붙은 SET으로 저장합니다. bcrypt는
// 없고, 토큰을 위해 DB를 읽는 일도 없습니다. JWT 검증도 메모리 안에서 끝납니다.
// 그래서 ioredis 클러스터 처리량을 가장 명확하게 측정합니다.
//
// 측정 전 준비는 이렇게 합니다. 워커마다 한 번씩 가입과 로그인을 끝내고, 받은
// 토큰으로 refresh를 반복합니다. 워커마다 각자의 토큰을 들고 있어, 같은 토큰을
// 여러 워커가 동시에 회전시키며 무효화를 부르는 경합이 일어나지 않습니다.
// refresh 한 번은 저장된 토큰 하나를 원자적으로 회전시킵니다.
//
// 환경 변수는 `harness.js`와 같다: `SERVER_URL`, `CONCURRENCY`,
// `DURATION_MS`, `WARMUP_MS`, `LABEL`.

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const CONCURRENCY = Number(process.env.CONCURRENCY || 100)
const DURATION_MS = Number(process.env.DURATION_MS || 30_000)
const WARMUP_MS = Number(process.env.WARMUP_MS || 3_000)
const LABEL = process.env.LABEL || ''

const url = new URL(SERVER_URL)

function makeAgent() {
    return new http.Agent({ keepAlive: true, maxSockets: 4 })
}

function uniqueEmail(workerId, seed) {
    return `perf-refresh.${seed}.${workerId}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

function doRequest(agent, method, pathname, body) {
    const payload = body == null ? null : JSON.stringify(body)
    return new Promise((resolve) => {
        const start = process.hrtime.bigint()
        const headers = { accept: 'application/json' }
        if (payload != null) {
            headers['content-type'] = 'application/json'
            headers['content-length'] = Buffer.byteLength(payload)
        }
        const r = http.request(
            { agent, hostname: url.hostname, port: url.port, path: pathname, method, headers },
            (res) => {
                const chunks = []
                res.on('data', (c) => chunks.push(c))
                res.on('end', () => {
                    const end = process.hrtime.bigint()
                    let parsed = null
                    try {
                        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
                    } catch {}
                    resolve({
                        status: res.statusCode,
                        replicaId: res.headers['x-replica-id'] || null,
                        body: parsed,
                        latencyNs: Number(end - start)
                    })
                })
            }
        )
        r.on('error', () => {
            const end = process.hrtime.bigint()
            resolve({ status: -1, replicaId: null, body: null, latencyNs: Number(end - start) })
        })
        if (payload != null) r.write(payload)
        r.end()
    })
}

async function setupWorker(workerId, seed) {
    const agent = makeAgent()
    const email = uniqueEmail(workerId, seed)
    const password = 'refreshpass'

    const create = await doRequest(agent, 'POST', '/users', {
        name: `r${workerId}`,
        email,
        password,
        birthDate: '1990-01-01T00:00:00.000Z'
    })
    if (create.status !== 201) {
        agent.destroy()
        throw new Error(`worker ${workerId} setup: create returned ${create.status}`)
    }

    const login = await doRequest(agent, 'POST', '/users/login', { email, password })
    if (login.status !== 200 || !login.body || !login.body.refreshToken) {
        agent.destroy()
        throw new Error(`worker ${workerId} setup: login returned ${login.status}`)
    }

    return { agent, refreshToken: login.body.refreshToken }
}

async function workerLoop(workerId, state, stopAt, samplesRef, statusesRef, replicasRef) {
    while (Date.now() < stopAt) {
        const result = await doRequest(state.agent, 'POST', '/users/refresh', {
            refreshToken: state.refreshToken
        })
        if (samplesRef.sampling) {
            samplesRef.values.push(result.latencyNs)
            statusesRef.map.set(result.status, (statusesRef.map.get(result.status) || 0) + 1)
            if (result.replicaId) replicasRef.set.add(result.replicaId)
        }
        // 측정 구간이 끝난 뒤에도 저장된 토큰이 어긋나지 않도록 회전은 계속합니다.
        if (result.status === 200 && result.body && result.body.refreshToken) {
            state.refreshToken = result.body.refreshToken
        } else if (result.status !== 200) {
            // 토큰이 무효가 된 경우입니다. 워커가 서로 격리돼 있으면 일어나지 않아야
            // 하지만, 같은 사용자에 대해 동시 refresh가 들어오면 발생합니다.
            // 이 워커는 여기서 끝냅니다.
            return
        }
    }
}

function percentile(sorted, p) {
    if (sorted.length === 0) return 0
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
    return sorted[idx]
}

async function captureDockerStats(durationMs) {
    const { spawn } = require('child_process')
    return new Promise((resolve) => {
        const proc = spawn('docker', [
            'stats',
            '--no-stream',
            '--format',
            '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}'
        ])
        let out = ''
        proc.stdout.on('data', (c) => (out += c.toString()))
        proc.on('close', () => resolve(out))
        setTimeout(() => proc.kill('SIGKILL'), durationMs + 2000)
    })
}

async function main() {
    console.error(
        `[perf-refresh] server=${SERVER_URL} concurrency=${CONCURRENCY} warmup=${WARMUP_MS}ms duration=${DURATION_MS}ms label=${LABEL || '(none)'}`
    )

    // 측정 전 준비 단계. 워커마다 각자의 사용자를 만들고 로그인합니다.
    const seed = Date.now()
    console.error(`[perf-refresh] setting up ${CONCURRENCY} users...`)
    const setupT0 = Date.now()
    const workerStates = await Promise.all(
        Array.from({ length: CONCURRENCY }, (_, i) => setupWorker(i, seed))
    )
    console.error(`[perf-refresh] setup done in ${Date.now() - setupT0} ms`)

    const samples = { sampling: false, values: [] }
    const statuses = { map: new Map() }
    const replicas = { set: new Set() }

    const warmupEnd = Date.now() + WARMUP_MS
    const measureEnd = warmupEnd + DURATION_MS

    setTimeout(() => {
        samples.sampling = true
        console.error(`[perf-refresh] warmup done, measuring for ${DURATION_MS}ms`)
    }, WARMUP_MS)

    const statsSnapshots = []
    for (let i = 1; i <= 3; i++) {
        setTimeout(
            () => {
                captureDockerStats(2000).then((s) => statsSnapshots.push(s))
            },
            WARMUP_MS + (DURATION_MS * i) / 4
        )
    }

    const workers = workerStates.map((state, i) =>
        workerLoop(i, state, measureEnd, samples, statuses, replicas)
    )
    await Promise.all(workers)

    for (const s of workerStates) s.agent.destroy()

    const sorted = samples.values.slice().sort((a, b) => a - b)
    const rps = sorted.length / (DURATION_MS / 1000)
    const toMs = (ns) => Math.round(ns / 1e4) / 100
    const statusEntries = Array.from(statuses.map.entries()).sort((a, b) => a[0] - b[0])

    const summary = {
        label: LABEL,
        scenario: 'user-refresh',
        concurrency: CONCURRENCY,
        durationMs: DURATION_MS,
        warmupMs: WARMUP_MS,
        totalSamples: sorted.length,
        rps: Math.round(rps * 100) / 100,
        latencyMs: {
            p50: toMs(percentile(sorted, 50)),
            p90: toMs(percentile(sorted, 90)),
            p95: toMs(percentile(sorted, 95)),
            p99: toMs(percentile(sorted, 99)),
            max: toMs(sorted[sorted.length - 1] || 0),
            min: toMs(sorted[0] || 0),
            mean: toMs(sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1))
        },
        statusCodes: Object.fromEntries(statusEntries),
        replicasSeen: replicas.set.size,
        host: { hostname: os.hostname(), cpus: os.cpus().length },
        timestamp: new Date().toISOString(),
        dockerStatsSnapshots: statsSnapshots
    }

    const outDir = path.resolve(__dirname, '../../../../_output/perf')
    fs.mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = path.join(outDir, `user-refresh-${stamp}${LABEL ? '-' + LABEL : ''}.json`)
    fs.writeFileSync(file, JSON.stringify(summary, null, 2))

    console.error(
        `[perf-refresh] RPS=${summary.rps}  p50=${summary.latencyMs.p50}ms  p95=${summary.latencyMs.p95}ms  p99=${summary.latencyMs.p99}ms  max=${summary.latencyMs.max}ms  samples=${summary.totalSamples}  statuses=${JSON.stringify(summary.statusCodes)}  replicas=${summary.replicasSeen}`
    )
    console.error(`[perf-refresh] wrote ${file}`)
    console.log(JSON.stringify(summary))
}

main().catch((e) => {
    console.error('[perf-refresh] error:', e)
    process.exit(1)
})
