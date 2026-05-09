// mono stack 용 sustained-load perf 하네스.
//
// 정해진 concurrency 수준에서 시나리오별 throughput + latency percentile 을 측정한다.
// stdout 마지막 줄에 JSON 을 출력하고 stderr 에 사람이 읽기 좋은 요약을 출력한다.
// 튜닝 사이클마다 반복 호출되도록 설계됐고, raw 결과는
// _output/perf/<scenario>-<timestamp>.json 에 기록된다.
//
// Env:
//   SERVER_URL     기본값 http://localhost:3000
//   SCENARIO       user-write | user-read | mixed    (기본: user-write)
//   CONCURRENCY    동시 요청 개수                              (기본: 100)
//   DURATION_MS    steady-state 측정 시간 ms                    (기본: 30000)
//   WARMUP_MS      측정 창 진입 전 warmup 시간                  (기본: 3000)
//   LABEL          JSON 출력에 저장되는 자유 형식 tag           (기본: '')

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const SCENARIO = process.env.SCENARIO || 'user-write'
const CONCURRENCY = Number(process.env.CONCURRENCY || 100)
const DURATION_MS = Number(process.env.DURATION_MS || 30_000)
const WARMUP_MS = Number(process.env.WARMUP_MS || 3_000)
const LABEL = process.env.LABEL || ''
const ACCEPT_GZIP = process.env.ACCEPT_GZIP === '1'

const url = new URL(SERVER_URL)
// keepAlive=true 로 nginx keepalive pool 을 사용한다. worker 마다 자체 Agent 를
// 갖게 해 ioredis/nginx 측에서 보고 싶은 동작 (pool-level queueing) 을 가리는
// socket contention 을 피한다. TCP layer 가 병목이 되어서는 안 된다.
function makeAgent() {
    return new http.Agent({ keepAlive: true, maxSockets: 4 })
}

function uniqueEmail(workerId, seq) {
    return `perf.${Date.now()}.${workerId}.${seq}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

function buildRequestFactory(scenario) {
    if (scenario === 'user-write') {
        return (workerId, seq) => ({
            method: 'POST',
            path: '/users',
            body: {
                name: `perf-${workerId}-${seq}`,
                email: uniqueEmail(workerId, seq),
                password: 'perfpassword',
                birthDate: '1990-01-01T00:00:00.000Z'
            },
            expectStatus: 201
        })
    }
    if (scenario === 'user-read') {
        // NOTE: GET /users 는 JWT 필요 — 이 시나리오는 auth-reject throughput 을
        // 측정하지 mongo-read throughput 을 측정하는 게 아니다. 인증 없이 mongo-read
        // 를 재고 싶다면 theater-read 나 movie-read 를 사용한다.
        return () => ({ method: 'GET', path: '/users?take=50', body: null, expectStatus: 200 })
    }
    if (scenario === 'theater-write') {
        // POST /theaters 는 auth guard 가 없다; 순수 mongo write + majority commit.
        // body 는 작지만 무시할 수준은 아니다 (nested validation).
        return (workerId, seq) => ({
            method: 'POST',
            path: '/theaters',
            body: {
                name: `perf-theater-${Date.now()}-${workerId}-${seq}-${Math.random().toString(36).slice(2, 8)}`,
                location: { latitude: 37.5, longitude: 127.0 },
                seatmap: {
                    blocks: [
                        {
                            name: 'A',
                            rows: [
                                { name: '1', layout: 'OOOOOOOOOO' },
                                { name: '2', layout: 'OOOOOOOOOO' }
                            ]
                        }
                    ]
                }
            },
            expectStatus: 201
        })
    }
    if (scenario === 'theater-read') {
        // Pagination 은 page/size (PaginationDto) 사용, take/skip 아니다.
        return () => ({
            method: 'GET',
            path: '/theaters?page=1&size=50',
            body: null,
            expectStatus: 200
        })
    }
    if (scenario === 'theater-read-size1') {
        return () => ({
            method: 'GET',
            path: '/theaters?page=1&size=1',
            body: null,
            expectStatus: 200
        })
    }
    if (scenario === 'theater-read-name-filter') {
        // 좁은 substring 으로 매치 0 에 가까운 검색 (cycle-31 substring 회귀
        // 후 prefix 인덱스 미활용 — 현재는 collscan 베이스라인 측정용).
        return () => ({
            method: 'GET',
            path: '/theaters?page=1&size=50&name=perf-theater-17769404',
            body: null,
            expectStatus: 200
        })
    }
    if (scenario === 'movie-read') {
        return () => ({
            method: 'GET',
            path: '/movies?page=1&size=50',
            body: null,
            expectStatus: 200
        })
    }
    if (scenario === 'movie-write') {
        // 순수 mongo write (bcrypt 없음). 필터 측정 전 seed 용도.
        return (workerId, seq) => ({
            method: 'POST',
            path: '/movies',
            body: {
                title: `perf-movie-${Date.now()}-${workerId}-${seq}-${Math.random().toString(36).slice(2, 8)}`
            },
            expectStatus: 201
        })
    }
    if (scenario === 'movie-read-title-filter') {
        // 좁은 substring 으로 매치 0 에 가까운 검색 (cycle-31 substring 회귀
        // 후 prefix 인덱스 미활용 — 현재는 collscan 베이스라인 측정용).
        return () => ({
            method: 'GET',
            path: '/movies?page=1&size=50&title=perf-movie-17769404',
            body: null,
            expectStatus: 200
        })
    }
    if (scenario === 'health') {
        return () => ({ method: 'GET', path: '/health', body: null, expectStatus: 200 })
    }
    throw new Error(`unknown scenario: ${scenario}`)
}

function doRequest(agent, req) {
    const payload = req.body == null ? null : JSON.stringify(req.body)
    return new Promise((resolve) => {
        const start = process.hrtime.bigint()
        const headers = { accept: 'application/json' }
        if (ACCEPT_GZIP) headers['accept-encoding'] = 'gzip'
        if (payload != null) {
            headers['content-type'] = 'application/json'
            headers['content-length'] = Buffer.byteLength(payload)
        }
        const r = http.request(
            {
                agent,
                hostname: url.hostname,
                port: url.port,
                path: req.path,
                method: req.method,
                headers
            },
            (res) => {
                res.on('data', () => {}) // 비우기
                res.on('end', () => {
                    const end = process.hrtime.bigint()
                    resolve({
                        status: res.statusCode,
                        replicaId: res.headers['x-replica-id'] || null,
                        latencyNs: Number(end - start)
                    })
                })
                res.on('error', () => {
                    const end = process.hrtime.bigint()
                    resolve({ status: -2, replicaId: null, latencyNs: Number(end - start) })
                })
            }
        )
        r.on('error', () => {
            const end = process.hrtime.bigint()
            resolve({ status: -1, replicaId: null, latencyNs: Number(end - start) })
        })
        if (payload != null) r.write(payload)
        r.end()
    })
}

async function workerLoop(workerId, factory, stopAt, samplesRef, statusesRef, replicasRef, seqRef) {
    const agent = makeAgent()
    while (Date.now() < stopAt) {
        const seq = seqRef.count++
        const req = factory(workerId, seq)
        const { status, replicaId, latencyNs } = await doRequest(agent, req)
        if (samplesRef.sampling) {
            samplesRef.values.push(latencyNs)
            statusesRef.map.set(status, (statusesRef.map.get(status) || 0) + 1)
            if (replicaId) replicasRef.set.add(replicaId)
        }
    }
    agent.destroy()
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
    const factory = buildRequestFactory(SCENARIO)
    console.error(
        `[perf] server=${SERVER_URL} scenario=${SCENARIO} concurrency=${CONCURRENCY} warmup=${WARMUP_MS}ms duration=${DURATION_MS}ms label=${LABEL || '(none)'}`
    )

    const samples = { sampling: false, values: [] }
    const statuses = { map: new Map() }
    const replicas = { set: new Set() }
    const seq = { count: 0 }

    const warmupEnd = Date.now() + WARMUP_MS
    const measureEnd = warmupEnd + DURATION_MS
    const workers = []
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(workerLoop(i, factory, measureEnd, samples, statuses, replicas, seq))
    }

    setTimeout(() => {
        samples.sampling = true
        console.error(`[perf] warmup done, measuring for ${DURATION_MS}ms`)
    }, WARMUP_MS)

    // Stats snapshots: 측정 창 안에 균등하게 3 개의 snapshot 을 찍는다.
    const statsSnapshots = []
    for (let i = 1; i <= 3; i++) {
        setTimeout(
            () => {
                captureDockerStats(2000).then((s) => statsSnapshots.push(s))
            },
            WARMUP_MS + (DURATION_MS * i) / 4
        )
    }

    await Promise.all(workers)

    const sorted = samples.values.slice().sort((a, b) => a - b)
    const rps = sorted.length / (DURATION_MS / 1000)
    const toMs = (ns) => Math.round(ns / 1e4) / 100
    const statusEntries = Array.from(statuses.map.entries()).sort((a, b) => a[0] - b[0])

    const summary = {
        label: LABEL,
        scenario: SCENARIO,
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
    const file = path.join(outDir, `${SCENARIO}-${stamp}${LABEL ? '-' + LABEL : ''}.json`)
    fs.writeFileSync(file, JSON.stringify(summary, null, 2))

    console.error(
        `[perf] RPS=${summary.rps}  p50=${summary.latencyMs.p50}ms  p95=${summary.latencyMs.p95}ms  p99=${summary.latencyMs.p99}ms  max=${summary.latencyMs.max}ms  samples=${summary.totalSamples}  statuses=${JSON.stringify(summary.statusCodes)}  replicas=${summary.replicasSeen}`
    )
    console.error(`[perf] wrote ${file}`)
    // pipe 하기 쉽도록 stdout 에 single JSON line 출력
    console.log(JSON.stringify(summary))
}

main().catch((e) => {
    console.error('[perf] error:', e)
    process.exit(1)
})
