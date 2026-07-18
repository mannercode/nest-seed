/**
 * k6 메트릭 모델에서 주의할 점:
 *  - Trend는 percentile만 보고 count는 없으므로 표본 수는 Counter(`measured_status`)로 같이 잰다.
 *  - 태그별 Counter 집계는 thresholds로 사전 정의해야 handleSummary에서 분리해 볼 수 있다.
 *    그래서 추적 대상 status code는 미리 박아 둔다(`TRACKED_STATUSES`).
 *  - 레플리카 ID 같은 동적 값은 thresholds에 박을 수 없으므로 별도 추적하지 않는다.
 *    필요하면 `k6 run --out json=...`으로 raw 데이터를 뽑아 후처리한다.
 */

// 클라이언트 에러(연결 실패)는 k6가 0으로 보고한다.
const TRACKED_STATUSES = [0, 200, 201, 204, 400, 401, 403, 404, 409, 422, 500, 502, 503]

function readPositiveInt(name, defaultValue) {
    const raw = __ENV[name]
    if (raw === undefined || raw === '') return defaultValue
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n <= 0 || String(n) !== raw.trim()) {
        throw new Error(`${name}는 양의 정수여야 한다. 받은 값: ${JSON.stringify(raw)}`)
    }
    return n
}

export function readOptions() {
    // 대상 서버는 반드시 명시해서 받는다.
    // 기본값으로 조용히 붙으면 포트 3000에 dev 단일 프로세스와 deploy 4-replica 어느 쪽이 떠 있었는지 결과만 봐서는 구분할 수 없다.
    const serverUrl = __ENV.SERVER_URL
    if (!serverUrl) {
        throw new Error(
            'SERVER_URL must be set (예: bash tests/api-perf/mixed-runner.sh 사용법 참고)'
        )
    }
    return {
        serverUrl,
        concurrency: readPositiveInt('CONCURRENCY', 100),
        durationMs: readPositiveInt('DURATION_MS', 30_000),
        warmupMs: readPositiveInt('WARMUP_MS', 3_000),
        label: __ENV.LABEL || '',
        acceptGzip: __ENV.ACCEPT_GZIP === '1'
    }
}

export function buildScenarioOptions(opts) {
    const thresholds = {}
    for (const s of TRACKED_STATUSES) {
        // 항상 참인 임계치. 단순히 submetric을 등록해 handleSummary에서 태그별로 분리해 보기 위함이다.
        thresholds[`measured_status{status:${s}}`] = ['count>=0']
    }
    return {
        scenarios: {
            main: {
                executor: 'constant-vus',
                vus: opts.concurrency,
                duration: `${opts.warmupMs + opts.durationMs}ms`,
                gracefulStop: '5s'
            }
        },
        // 응답 본문은 토큰 파싱이 필요한 시나리오를 위해 보존한다.
        discardResponseBodies: false,
        // 기본값엔 p(99)/p(50)이 없어 buildSummary와 어긋나므로 명시한다.
        summaryTrendStats: ['min', 'avg', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
        // setup()의 http.batch가 VU 수만큼 병렬 실행되도록 막혀 있는 기본 한도를 푼다.
        // 측정 구간의 개별 http 호출은 영향받지 않는다(이 옵션은 batch 전용).
        batch: opts.concurrency,
        batchPerHost: opts.concurrency,
        thresholds
    }
}

/**
 * 측정 구간 시작 시각(ms epoch).
 * k6는 모든 VU의 모듈 초기화를 setup()보다 먼저 실행하므로,
 * setup()이 있는 하네스는 이 함수를 setup() 끝에서 호출해 반환값으로 내려보내야
 * setup 소요 시간이 워밍업 창을 잠식하지 않는다.
 * setup()이 없는 하네스는 모듈 초기화 시점에 호출해도 편차가 무시할 수준이다(<1s).
 */
export function measurementStart(opts) {
    return Date.now() + opts.warmupMs
}

function round2(n) {
    return Math.round(n * 100) / 100
}

/**
 * 결과 메트릭을 perf 결과 JSON으로 변환한다.
 * 측정용 metric 이름은 measured_latency / measured_status로 고정.
 * 표본 수는 measured_status의 untagged 합계로 같이 잰다.
 *
 * 측정 구간에 표본이 한 건도 없으면 의도된 구간 설정이 어긋난 것이므로 throw해 silently 0을 보고하지 않는다.
 */
export function buildSummary({ data, scenario, opts, extra = {} }) {
    const latencyMetric = data.metrics.measured_latency
    const statusMetric = data.metrics.measured_status
    if (!latencyMetric || !statusMetric) {
        throw new Error(
            'expected measured_latency and measured_status metrics; check hand-shake with harness'
        )
    }

    const totalStatus = statusMetric.values.count
    if (totalStatus === 0) {
        throw new Error(
            `no samples collected in measurement window — check WARMUP_MS (${opts.warmupMs}) ` +
                `vs DURATION_MS (${opts.durationMs}) and that the server actually responded`
        )
    }

    const latency = latencyMetric.values
    const rps = round2(totalStatus / (opts.durationMs / 1000))

    const statusCodes = {}
    for (const key of Object.keys(data.metrics)) {
        const m = key.match(/^measured_status\{status:(.+)\}$/)
        if (!m) continue
        const count = data.metrics[key].values.count
        if (count > 0) statusCodes[m[1]] = count
    }
    // 추적 목록 밖의 상태가 있으면 합계 차이로 "other"에 잡힌다.
    const knownSum = Object.values(statusCodes).reduce((a, b) => a + b, 0)
    if (totalStatus > knownSum) {
        statusCodes.other = totalStatus - knownSum
    }

    return {
        label: opts.label,
        scenario,
        // 무엇을 측정했는지 결과 파일만으로 판별할 수 있게 대상 서버를 기록한다.
        serverUrl: opts.serverUrl,
        concurrency: opts.concurrency,
        durationMs: opts.durationMs,
        warmupMs: opts.warmupMs,
        totalSamples: totalStatus,
        rps,
        latencyMs: {
            p50: round2(latency.med),
            p90: round2(latency['p(90)']),
            p95: round2(latency['p(95)']),
            p99: round2(latency['p(99)']),
            min: round2(latency.min),
            mean: round2(latency.avg),
            max: round2(latency.max)
        },
        statusCodes,
        timestamp: new Date().toISOString(),
        ...extra
    }
}

/** `tests/api-perf/_output/<scenario>-<timestamp>[-<label>].json` 절대 경로. */
export function summaryFilePath(scenario, label) {
    if (!__ENV.WORKSPACE_ROOT) {
        throw new Error('WORKSPACE_ROOT must be set')
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const suffix = label ? `-${label}` : ''
    return `${__ENV.WORKSPACE_ROOT}/tests/api-perf/_output/${scenario}-${stamp}${suffix}.json`
}

/**
 * handleSummary 표준 반환.
 *  - stdout: 한 줄 JSON (파이프 후처리용)
 *  - stderr: 사람이 읽을 요약
 *  - file:   `tests/api-perf/_output/...` 보존본
 */
export function summaryReturn({ summary, logTag }) {
    const file = summaryFilePath(summary.scenario, summary.label)
    return {
        stdout: JSON.stringify(summary) + '\n',
        stderr: formatHumanLine(summary, logTag),
        [file]: JSON.stringify(summary, null, 2)
    }
}

function formatHumanLine(s, logTag) {
    const m = s.latencyMs
    return (
        `[${logTag}] RPS=${s.rps}  p50=${m.p50}ms  p95=${m.p95}ms  p99=${m.p99}ms  max=${m.max}ms ` +
        ` samples=${s.totalSamples}  statuses=${JSON.stringify(s.statusCodes)}\n`
    )
}
