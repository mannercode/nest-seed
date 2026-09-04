import http from 'k6/http'
import exec from 'k6/execution'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

import { positiveInteger, randomHex, summaryOutput } from './benchmark-common.js'

const MODE = __ENV.MODE
const SERVER_URL = __ENV.SERVER_URL
const ADMIN_ACCESS_TOKEN = __ENV.ADMIN_ACCESS_TOKEN
const DURATION_MS = positiveInteger('DURATION_MS', 30_000)
const WARMUP_MS = positiveInteger('WARMUP_MS', 3_000)
const SETTLE_MS = 10_000

if (MODE !== 'seed' && MODE !== 'benchmark') {
    throw new Error('MODE must be seed or benchmark')
}
if (!SERVER_URL) throw new Error('SERVER_URL must be set')
if (!ADMIN_ACCESS_TOKEN) throw new Error('ADMIN_ACCESS_TOKEN must be set')

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

function createScenario(
    scenarios,
    thresholds,
    name,
    operation,
    vus,
    startTime,
    acceptEncoding = 'gzip'
) {
    if (vus === 0) return

    const metricName = name.replaceAll('-', '_')
    metrics.set(name, {
        failed: new Rate(`${metricName}_failed`),
        latency: new Trend(`${metricName}_latency`, true),
        requests: new Counter(`${metricName}_requests`),
        acceptEncoding
    })
    thresholds[`${metricName}_failed`] = ['rate==0']
    thresholds[`${metricName}_requests`] = ['count>0']
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
    const thresholds = {}
    let startTime = 0

    for (const benchmarkCase of CASES) {
        createScenario(
            scenarios,
            thresholds,
            `${benchmarkCase.name}_read`,
            'read',
            benchmarkCase.readVus,
            startTime,
            benchmarkCase.acceptEncoding
        )
        createScenario(
            scenarios,
            thresholds,
            `${benchmarkCase.name}_write`,
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

function seedOptions() {
    return {
        discardResponseBodies: true,
        scenarios: {
            seed: {
                executor: 'constant-vus',
                exec: 'seed',
                vus: 100,
                duration: `${DURATION_MS}ms`,
                gracefulStop: '5s'
            }
        },
        thresholds: { checks: ['rate==1'] }
    }
}

export const options = MODE === 'seed' ? seedOptions() : benchmarkOptions()

const headers = {
    accept: 'application/json',
    authorization: `Bearer ${ADMIN_ACCESS_TOKEN}`,
    'content-type': 'application/json'
}

function createTheater(acceptEncoding = 'gzip') {
    return http.post(
        `${SERVER_URL}/theaters`,
        JSON.stringify({
            name: `benchmark-${__VU}-${__ITER}-${randomHex()}`,
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
        }),
        { headers: { ...headers, 'Accept-Encoding': acceptEncoding } }
    )
}

export function seed() {
    const response = createTheater()
    check(response, { 'theater creation returns 201': (result) => result.status === 201 })
}

export function read() {
    const metric = currentMetric()
    const response = http.get(`${SERVER_URL}/theaters?page=1&size=50`, {
        headers: { ...headers, 'Accept-Encoding': metric.acceptEncoding }
    })
    record(response, 200, metric)
}

export function write() {
    const metric = currentMetric()
    const response = createTheater(metric.acceptEncoding)
    record(response, 201, metric)
}

function currentMetric() {
    const metric = metrics.get(exec.scenario.name)
    if (!metric) throw new Error(`No metrics registered for ${exec.scenario.name}`)
    return metric
}

function record(response, expectedStatus, metric) {
    const failed = response.status !== expectedStatus
    metric.failed.add(failed)
    check(response, { [`status is ${expectedStatus}`]: () => !failed })

    if (exec.scenario.progress >= WARMUP_MS / (WARMUP_MS + DURATION_MS)) {
        metric.latency.add(response.timings.duration)
        metric.requests.add(1)
    }
}

function metricSummary(data, name, vus) {
    const failed = data.metrics[`${name}_failed`].values
    const latency = data.metrics[`${name}_latency`].values
    const requests = data.metrics[`${name}_requests`].values.count

    return {
        vus,
        acceptEncoding: metrics.get(name).acceptEncoding,
        requests,
        requestsPerSecond: round2(requests / (DURATION_MS / 1000)),
        failedRate: failed.rate,
        latencyMs: {
            median: round2(latency.med),
            p90: round2(latency['p(90)']),
            p95: round2(latency['p(95)']),
            p99: round2(latency['p(99)']),
            max: round2(latency.max)
        }
    }
}

function benchmarkSummary(data) {
    const cases = {}
    for (const benchmarkCase of CASES) {
        const result = {}
        if (benchmarkCase.readVus > 0) {
            result.read = metricSummary(data, `${benchmarkCase.name}_read`, benchmarkCase.readVus)
        }
        if (benchmarkCase.writeVus > 0) {
            result.write = metricSummary(
                data,
                `${benchmarkCase.name}_write`,
                benchmarkCase.writeVus
            )
        }
        cases[benchmarkCase.name] = result
    }

    return {
        generatedAt: new Date().toISOString(),
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
    return summaryOutput(MODE === 'benchmark' ? benchmarkSummary(data) : data)
}
