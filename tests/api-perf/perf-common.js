/**
 * api-perf 하네스들의 공통 부분을 모은 모듈이다.
 *
 * 각 하네스는 시나리오 차이만 담당하면 된다.
 *  - 워커별 초기 setup이 필요한 경우: 워커 setup 함수와 매 요청 함수를 함께 넘긴다.
 *  - 동일 요청을 반복하는 경우: 매 요청 함수만 넘긴다.
 *
 * 측정 흐름:
 *  1) 워커마다 (선택적) setup을 실행한다.
 *  2) WARMUP_MS 동안 부하만 걸고 표본은 모으지 않는다.
 *  3) DURATION_MS 동안 latency·status·replica id를 모은다.
 *  4) 측정 중 같은 간격으로 docker stats 스냅숏 세 번을 찍는다.
 *  5) p50/p90/p95/p99/min/mean/max와 RPS를 계산해 stdout(JSON 한 줄)과 stderr(요약)에 출력하고,
 *     `_output/perf/<scenario>-<timestamp>[-<label>].json`로 저장한다.
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const NS_PER_MS = 1e6

/** 공통 환경 변수를 읽어 옵션 객체로 만든다. */
function readOptions(overrides = {}) {
    return {
        serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
        concurrency: Number(process.env.CONCURRENCY || 100),
        durationMs: Number(process.env.DURATION_MS || 30_000),
        warmupMs: Number(process.env.WARMUP_MS || 3_000),
        label: process.env.LABEL || '',
        acceptGzip: process.env.ACCEPT_GZIP === '1',
        ...overrides
    }
}

/**
 * 워커마다 별도 Agent를 둔다.
 * 같은 Agent를 공유하면 워커가 같은 소켓 풀에서 경합해, 측정 대상인 서버 큐 동작이 가려진다.
 */
function makeAgent() {
    return new http.Agent({ keepAlive: true, maxSockets: 4 })
}

/**
 * `body`는 JSON으로 직렬화한다.
 * 응답은 항상 모아서 JSON 파싱을 시도한다. 파싱 실패는 무시한다(상태 코드만 보는 경우가 많기 때문).
 * 응답 시간은 process.hrtime.bigint로 잰다(ns).
 */
function doRequest({ agent, urlObj, method, requestPath, headers, body }) {
    const payload = body == null ? null : JSON.stringify(body)
    const requestHeaders = { accept: 'application/json', ...(headers || {}) }
    if (payload != null) {
        requestHeaders['content-type'] = 'application/json'
        requestHeaders['content-length'] = Buffer.byteLength(payload)
    }

    return new Promise((resolve) => {
        const startNs = process.hrtime.bigint()
        const req = http.request(
            {
                agent,
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: requestPath,
                method,
                headers: requestHeaders
            },
            (res) => {
                const chunks = []
                res.on('data', (c) => chunks.push(c))
                res.on('end', () => {
                    let parsed = null
                    try {
                        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
                    } catch {
                        /* status code만 필요한 경우가 많으므로 파싱 실패는 그냥 넘긴다. */
                    }
                    resolve({
                        status: res.statusCode,
                        replicaId: res.headers['x-replica-id'] || null,
                        body: parsed,
                        latencyNs: Number(process.hrtime.bigint() - startNs)
                    })
                })
            }
        )
        req.on('error', () => {
            resolve({
                status: -1,
                replicaId: null,
                body: null,
                latencyNs: Number(process.hrtime.bigint() - startNs)
            })
        })
        if (payload != null) req.write(payload)
        req.end()
    })
}

function percentile(sorted, p) {
    if (sorted.length === 0) return 0
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
    return sorted[idx]
}

function nsToMs(ns) {
    return Math.round(ns / NS_PER_MS / 0.01) * 0.01
}

/**
 * `docker stats --no-stream`을 호출해 한 줄짜리 텍스트 결과를 모은다.
 * 측정 구간이 끝나도 spawn이 살아 있으면 SIGKILL로 종료한다(약 2초 그레이스).
 */
function captureDockerStats(durationMs) {
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

function writeSummaryFile(summary, scenario, label) {
    if (!process.env.WORKSPACE_ROOT) {
        throw new Error('WORKSPACE_ROOT must be set')
    }
    const outDir = path.resolve(process.env.WORKSPACE_ROOT, '_output/perf')
    fs.mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = path.join(outDir, `${scenario}-${stamp}${label ? '-' + label : ''}.json`)
    fs.writeFileSync(file, JSON.stringify(summary, null, 2))
    return file
}

/**
 * 공통 측정 루프 실행기.
 *
 * @param {object} options
 * @param {string} options.scenario  - 결과에 기록할 시나리오 이름
 * @param {string} options.logTag    - stderr 출력 prefix(예: 'perf-refresh')
 * @param {object} [options.extraSummary] - 결과 JSON에 합쳐 넣을 추가 필드
 * @param {Function} [options.setupWorker]
 *   `(workerId, seed) => state` 형태. setup이 필요한 시나리오에서만 제공.
 *   state는 perRequest에 그대로 전달된다(`agent`를 포함하면 main이 측정 후 정리한다).
 * @param {Function} options.perRequest
 *   `(state, workerId, seq) => requestSpec | Promise<requestSpec>` 형태.
 *   requestSpec은 `{ method, path, headers?, body? }`.
 *   state가 없는 시나리오는 첫 인자를 `null`로 받는다.
 * @param {Function} [options.onResponse]
 *   `(state, response)` 형태. 토큰 회전처럼 응답을 상태에 반영해야 할 때 사용.
 *   `true`를 반환하면 해당 워커는 즉시 종료한다(예: 토큰 무효화로 더 진행 불가).
 */
async function runPerf({
    scenario,
    logTag,
    extraSummary,
    setupWorker,
    perRequest,
    onResponse,
    options
}) {
    const opts = options || readOptions()
    const urlObj = new URL(opts.serverUrl)

    console.error(
        `[${logTag}] server=${opts.serverUrl} scenario=${scenario} concurrency=${opts.concurrency} warmup=${opts.warmupMs}ms duration=${opts.durationMs}ms label=${opts.label || '(none)'}`
    )

    // 워커별 state: setup이 있으면 그 결과, 없으면 그냥 agent만 든 객체.
    const seed = Date.now()
    const workerStates = await Promise.all(
        Array.from({ length: opts.concurrency }, async (_, workerId) => {
            if (setupWorker) {
                console.error(`[${logTag}] setup worker ${workerId}/${opts.concurrency}`)
                return setupWorker({ workerId, seed, urlObj, opts, agent: makeAgent() })
            }
            return { agent: makeAgent() }
        })
    )

    const samples = { sampling: false, values: [] }
    const statuses = new Map()
    const replicas = new Set()

    const measureEndAt = Date.now() + opts.warmupMs + opts.durationMs

    setTimeout(() => {
        samples.sampling = true
        console.error(`[${logTag}] warmup done, measuring for ${opts.durationMs}ms`)
    }, opts.warmupMs)

    // 측정 구간을 4등분해 1/4, 2/4, 3/4 지점에 docker stats 스냅숏을 찍는다.
    const statsSnapshots = []
    for (let i = 1; i <= 3; i++) {
        setTimeout(
            () => captureDockerStats(2000).then((s) => statsSnapshots.push(s)),
            opts.warmupMs + (opts.durationMs * i) / 4
        )
    }

    async function workerLoop(state, workerId) {
        let seq = 0
        while (Date.now() < measureEndAt) {
            const req = await perRequest(state, workerId, seq++)
            const result = await doRequest({
                agent: state.agent,
                urlObj,
                method: req.method,
                requestPath: req.path,
                headers: req.headers,
                body: req.body
            })

            if (samples.sampling) {
                samples.values.push(result.latencyNs)
                statuses.set(result.status, (statuses.get(result.status) || 0) + 1)
                if (result.replicaId) replicas.add(result.replicaId)
            }

            if (onResponse) {
                const stop = onResponse(state, result)
                if (stop === true) return
            }
        }
    }

    await Promise.all(workerStates.map((state, i) => workerLoop(state, i)))

    for (const state of workerStates) {
        if (state.agent) state.agent.destroy()
    }

    const sorted = samples.values.slice().sort((a, b) => a - b)
    const rps = sorted.length / (opts.durationMs / 1000)
    const summary = {
        label: opts.label,
        scenario,
        concurrency: opts.concurrency,
        durationMs: opts.durationMs,
        warmupMs: opts.warmupMs,
        totalSamples: sorted.length,
        rps: Math.round(rps * 100) / 100,
        latencyMs: {
            p50: nsToMs(percentile(sorted, 50)),
            p90: nsToMs(percentile(sorted, 90)),
            p95: nsToMs(percentile(sorted, 95)),
            p99: nsToMs(percentile(sorted, 99)),
            max: nsToMs(sorted[sorted.length - 1] || 0),
            min: nsToMs(sorted[0] || 0),
            mean: nsToMs(sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1))
        },
        statusCodes: Object.fromEntries(Array.from(statuses.entries()).sort((a, b) => a[0] - b[0])),
        replicasSeen: replicas.size,
        host: { hostname: os.hostname(), cpus: os.cpus().length },
        timestamp: new Date().toISOString(),
        dockerStatsSnapshots: statsSnapshots,
        ...(extraSummary || {})
    }

    const file = writeSummaryFile(summary, scenario, opts.label)

    console.error(
        `[${logTag}] RPS=${summary.rps}  p50=${summary.latencyMs.p50}ms  p95=${summary.latencyMs.p95}ms  p99=${summary.latencyMs.p99}ms  max=${summary.latencyMs.max}ms  samples=${summary.totalSamples}  statuses=${JSON.stringify(summary.statusCodes)}  replicas=${summary.replicasSeen}`
    )
    console.error(`[${logTag}] wrote ${file}`)
    // 파이프로 후처리하기 편하도록 결과는 stdout에 JSON 한 줄로 남긴다.
    console.log(JSON.stringify(summary))
}

module.exports = { readOptions, runPerf, doRequest, makeAgent }
