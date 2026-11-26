import http from 'k6/http'
import exec from 'k6/execution'
import encoding from 'k6/encoding'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

import { positiveInteger, randomHex, summaryOutput } from './benchmark-common.js'

const SERVER_URL = __ENV.SERVER_URL
const DURATION_MS = positiveInteger('DURATION_MS', 30_000)
const WARMUP_MS = positiveInteger('WARMUP_MS', 3_000)
const SETTLE_MS = 10_000

if (!SERVER_URL) throw new Error('SERVER_URL must be set')

// 두 읽기 전용 사례는 같은 크기의 프로필로 실제 압축 전송을 비교한다.
const compressionProfileName = 'Benchmark profile '.repeat(64)

const CASES = [
    { name: 'read_identity_200', readVus: 200, writeVus: 0, acceptEncoding: 'identity' },
    { name: 'read_gzip_200', readVus: 200, writeVus: 0, acceptEncoding: 'gzip' },
    { name: 'write_100', readVus: 0, writeVus: 100 },
    { name: 'mixed_r100_w50', readVus: 100, writeVus: 50 },
    { name: 'mixed_r100_w100', readVus: 100, writeVus: 100 },
    { name: 'mixed_r200_w50', readVus: 200, writeVus: 50 },
    { name: 'mixed_r200_w100', readVus: 200, writeVus: 100 }
]

const metrics = new Map()

function scenarioName(caseName, operation) {
    return `${caseName}_${operation}`
}

function createScenario(
    scenarios,
    thresholds,
    caseName,
    operation,
    vus,
    startTime,
    acceptEncoding
) {
    if (vus === 0) return

    const name = scenarioName(caseName, operation)
    const metricName = name.replaceAll('-', '_')
    const metric = {
        failed: new Rate(`${metricName}_failed`),
        latency: new Trend(`${metricName}_latency`, true),
        requests: new Counter(`${metricName}_requests`),
        started: new Counter(`${metricName}_started`),
        outsideWindow: new Counter(`${metricName}_completed_outside_window`),
        renewals: new Counter(`${metricName}_in_window_renewals`),
        compareEncoding: acceptEncoding !== undefined,
        acceptEncoding: acceptEncoding ?? 'gzip'
    }
    metrics.set(name, metric)
    thresholds[metric.failed.name] = ['rate==0']
    thresholds[metric.requests.name] = ['count>0']
    scenarios[name] = {
        executor: 'constant-vus',
        exec: operation,
        vus,
        duration: `${WARMUP_MS + DURATION_MS}ms`,
        startTime: `${startTime}ms`,
        gracefulStop: '5s'
    }
}

function benchmarkOptions() {
    const scenarios = {}
    const thresholds = { checks: ['rate==1'] }
    let startTime = 0

    for (const benchmarkCase of CASES) {
        createScenario(
            scenarios,
            thresholds,
            benchmarkCase.name,
            'read',
            benchmarkCase.readVus,
            startTime,
            benchmarkCase.acceptEncoding
        )
        createScenario(
            scenarios,
            thresholds,
            benchmarkCase.name,
            'write',
            benchmarkCase.writeVus,
            startTime
        )
        startTime += WARMUP_MS + DURATION_MS + SETTLE_MS
    }

    return {
        discardResponseBodies: true,
        scenarios,
        summaryTrendStats: ['min', 'avg', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
        thresholds
    }
}

export const options = benchmarkOptions()

const sessions = new Map()
const jsonHeaders = { 'content-type': 'application/json' }
const authParams = {
    headers: jsonHeaders,
    responseType: 'text',
    tags: { name: 'user authentication' }
}

function requireStatus(response, expected, path) {
    if (response.status !== expected)
        exec.test.abort(`Authentication ${path}: HTTP ${response.status}`)
}

export function setup() {
    // k6는 겹치지 않는 시나리오에 VU를 재배치한다. 각 전역 VU ID마다 압축 비교용과 수정 가능한 계정을 준비한다.
    const maxVus = Math.max(...CASES.map(({ readVus, writeVus }) => readVus + writeVus))
    const runId = randomHex()
    const accounts = Array.from({ length: maxVus * 2 }, (_, index) => ({
        email: `benchmark-${runId}-${String(index).padStart(String(maxVus * 2).length, '0')}@example.com`,
        password: 'Benchmark password 123!'
    }))
    const created = http.batch(
        accounts.map((account, index) => [
            'POST',
            SERVER_URL + '/users',
            JSON.stringify({
                ...account,
                name: index < maxVus ? compressionProfileName : 'Benchmark user',
                birthDate: '1990-01-01'
            }),
            authParams
        ])
    )
    for (const response of created) requireStatus(response, 201, '/users')
    const loggedIn = http.batch(
        accounts.map((account) => [
            'POST',
            SERVER_URL + '/users/login',
            JSON.stringify(account),
            authParams
        ])
    )
    const tokens = loggedIn.map((response) => {
        requireStatus(response, 200, '/users/login')
        const { accessToken, refreshToken } = response.json()
        return { accessToken, refreshToken, expiresAt: tokenExpiresAt(accessToken) }
    })
    return { compression: tokens.slice(0, maxVus), profile: tokens.slice(maxVus) }
}

function tokenExpiresAt(token) {
    const { exp } = JSON.parse(encoding.b64decode(token.split('.')[1], 'rawurl', 's'))
    if (!Number.isFinite(exp)) throw new Error('Access token has no valid expiry')
    return exp * 1000
}

function authenticatedHeaders(metric, prepared) {
    const pool = metric.compareEncoding ? 'compression' : 'profile'
    if (!sessions.has(pool)) sessions.set(pool, prepared[pool][exec.vu.idInTest - 1])
    let session = sessions.get(pool)
    const measurementStart = exec.scenario.startTime + WARMUP_MS
    const measurementEnd = measurementStart + DURATION_MS
    const renewAt = session.expiresAt - 60_000
    const firstRequest = session.scenario !== exec.scenario.name
    if (firstRequest) metric.renewals.add(0)
    const started = Date.now()
    if (started >= renewAt || (firstRequest && renewAt <= measurementEnd)) {
        const response = http.post(
            SERVER_URL + '/users/refresh',
            JSON.stringify({ refreshToken: session.refreshToken }),
            authParams
        )
        requireStatus(response, 200, '/users/refresh')
        const { accessToken, refreshToken } = response.json()
        session = { accessToken, refreshToken, expiresAt: tokenExpiresAt(accessToken) }
        sessions.set(pool, session)
        if (started < measurementEnd && Date.now() >= measurementStart) metric.renewals.add(1)
    }
    session.scenario = exec.scenario.name
    return {
        ...jsonHeaders,
        authorization: 'Bearer ' + session.accessToken,
        'Accept-Encoding': metric.acceptEncoding
    }
}

export function read(prepared) {
    const metric = currentMetric()
    const headers = authenticatedHeaders(metric, prepared)
    metric.started.add(1)
    const response = http.get(SERVER_URL + '/users/me', { headers })
    record(response, 200, metric)
}

export function write(prepared) {
    const metric = currentMetric()
    const headers = authenticatedHeaders(metric, prepared)
    metric.started.add(1)
    const response = http.patch(
        SERVER_URL + '/users/me',
        JSON.stringify({ name: 'benchmark-' + __VU + '-' + __ITER }),
        { headers }
    )
    record(response, 200, metric)
}

function currentMetric() {
    const metric = metrics.get(exec.scenario.name)
    if (!metric) throw new Error(`No metrics registered for ${exec.scenario.name}`)
    return metric
}

function record(response, expectedStatus, metric) {
    const elapsed = Date.now() - exec.scenario.startTime
    const failed = response.status !== expectedStatus
    const checks = { [`status is ${expectedStatus}`]: () => !failed }
    if (metric.compareEncoding) {
        checks[`response encoding is ${metric.acceptEncoding}`] = (res) =>
            (res.headers['Content-Encoding'] ?? 'identity') === metric.acceptEncoding
    }
    const valid = check(response, checks)
    if (elapsed >= WARMUP_MS && elapsed < WARMUP_MS + DURATION_MS) {
        metric.failed.add(!valid)
        metric.latency.add(response.timings.duration)
        metric.requests.add(1)
    } else {
        metric.outsideWindow.add(1)
    }
}

function metricSummary(data, name, vus) {
    const metric = metrics.get(name)
    const failed = data.metrics[metric.failed.name]?.values
    const latency = data.metrics[metric.latency.name]?.values
    const requests = data.metrics[metric.requests.name]?.values.count ?? 0
    const started = data.metrics[metric.started.name]?.values.count ?? 0
    const outsideWindow = data.metrics[metric.outsideWindow.name]?.values.count ?? 0

    return {
        vus,
        acceptEncoding: metric.acceptEncoding,
        requests,
        unfinishedRequests: started - outsideWindow - requests,
        requestsPerSecond: round2(requests / (DURATION_MS / 1000)),
        authRenewalsOverlappingWindow: data.metrics[metric.renewals.name]?.values.count ?? 0,
        failedRate: requests ? failed.rate : null,
        latencyMs: requests
            ? {
                  median: round2(latency.med),
                  p90: round2(latency['p(90)']),
                  p95: round2(latency['p(95)']),
                  p99: round2(latency['p(99)']),
                  max: round2(latency.max)
              }
            : null
    }
}

function benchmarkSummary(data) {
    const cases = {}
    for (const benchmarkCase of CASES) {
        const result = {}
        if (benchmarkCase.readVus > 0) {
            result.read = metricSummary(
                data,
                scenarioName(benchmarkCase.name, 'read'),
                benchmarkCase.readVus
            )
        }
        if (benchmarkCase.writeVus > 0) {
            result.write = metricSummary(
                data,
                scenarioName(benchmarkCase.name, 'write'),
                benchmarkCase.writeVus
            )
        }
        cases[benchmarkCase.name] = result
    }

    return {
        generatedAt: new Date().toISOString(),
        commit: __ENV.BENCHMARK_COMMIT,
        dirty: __ENV.BENCHMARK_DIRTY === 'true',
        dockerEngine: __ENV.BENCHMARK_ENGINE,
        images: __ENV.BENCHMARK_IMAGES.split('\n'),
        k6Image: __ENV.BENCHMARK_K6_IMAGE,
        serverUrl: SERVER_URL,
        durationMs: DURATION_MS,
        warmupMs: WARMUP_MS,
        cases
    }
}

function round2(value) {
    return Math.round(value * 100) / 100
}

export function handleSummary(data) {
    return summaryOutput(benchmarkSummary(data))
}
