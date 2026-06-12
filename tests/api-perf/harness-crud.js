/**
 * API 스택에 지속 부하를 걸어 시나리오별 처리량과 응답 시간 분위수를 측정하는 k6 하네스다.
 *
 * 결과는 stdout 마지막 줄에 JSON 한 줄로 출력하고, 사람이 읽을 요약은 stderr에 출력한다.
 * 원본 결과는 `tests/api-perf/_output/<scenario>-<timestamp>.json`에 저장한다.
 *
 * 환경 변수 (k6는 `--env` 또는 `K6_` 접두사로 전달):
 *  SERVER_URL    - 대상 서버 (필수 — dev 단일 프로세스와 deploy 4-replica를 묵시 기본값으로 헷갈리지 않게 명시한다)
 *  SCENARIO      - user-write | user-read | theater-write | theater-read | ... (기본 user-write)
 *  CONCURRENCY   - 동시 VU 수 (기본 100)
 *  DURATION_MS   - 측정 시간 ms (기본 30000)
 *  WARMUP_MS     - 워밍업 시간 ms (기본 3000)
 *  LABEL         - 결과에 같이 저장할 자유 태그 (기본 '')
 *  ACCEPT_GZIP   - '1'이면 `Accept-Encoding: gzip` 헤더 추가 (기본 미설정)
 *  ADMIN_ACCESS_TOKEN - admin 가드 뒤의 쓰기 시나리오(theater-write, movie-write)에 필요. runner.sh가 발급해 넘긴다
 *
 * 실행:
 *   mkdir -p tests/api-perf/_output  # k6는 출력 디렉토리를 만들지 않는다
 *   k6 run --env SERVER_URL=http://localhost:3000 --env SCENARIO=user-write tests/api-perf/harness-crud.js
 */

import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'
import {
    buildScenarioOptions,
    buildSummary,
    measurementStart,
    readOptions,
    summaryReturn
} from './perf-common.js'

const opts = readOptions()
const scenario = __ENV.SCENARIO || 'user-write'
const startAt = measurementStart(opts)

// 표준 k6 메트릭은 워밍업까지 포함하므로, 워밍업을 제외한 별도 측정용 메트릭을 둔다.
const latency = new Trend('measured_latency', true)
const statusCounter = new Counter('measured_status')

export const options = buildScenarioOptions(opts)

function uniqueEmail(vu, iter) {
    return `perf.${Date.now()}.${vu}.${iter}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

const SCENARIOS = {
    'user-write': (vu, iter) => ({
        method: 'POST',
        path: '/users',
        body: {
            name: `perf-${vu}-${iter}`,
            email: uniqueEmail(vu, iter),
            password: 'perfpassword',
            birthDate: '1990-01-01T00:00:00.000Z'
        }
    }),
    // `GET /users`는 JWT가 필요하다. 이 시나리오가 재는 것은 인증 실패 응답의 처리량이다.
    // 인증 없이 Mongo 읽기를 측정하고 싶으면 theater-read나 movie-read 시나리오를 쓴다.
    'user-read': () => ({ method: 'GET', path: '/users?take=50' }),
    // bcrypt 없는 Mongo 쓰기 + majority commit 비용을 잰다(admin 가드의 JWT 검증 포함 — ADMIN_ACCESS_TOKEN 필요).
    // 본문은 작지만 중첩 검증이 있어서 무시할 비용은 아니다.
    'theater-write': (vu, iter) => ({
        method: 'POST',
        path: '/theaters',
        body: {
            name: `perf-theater-${Date.now()}-${vu}-${iter}-${Math.random().toString(36).slice(2, 8)}`,
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
        }
    }),
    // 페이지네이션은 `take`/`skip`이 아니라 `PaginationDto`의 `page`/`size`로 받는다.
    'theater-read': () => ({ method: 'GET', path: '/theaters?page=1&size=50' }),
    'theater-read-size1': () => ({ method: 'GET', path: '/theaters?page=1&size=1' }),
    // 검색어를 좁게 잡아 매치 수를 거의 0으로 맞춘다.
    // 부분 문자열 정규식은 일반 인덱스를 활용하지 못해 컬렉션 전체를 스캔한다.
    'theater-read-name-filter': () => ({
        method: 'GET',
        path: '/theaters?page=1&size=50&name=perf-theater-17769404'
    }),
    'movie-read': () => ({ method: 'GET', path: '/movies?page=1&size=50' }),
    // bcrypt 없는 Mongo 쓰기(admin 가드 — ADMIN_ACCESS_TOKEN 필요). 필터 측정 전에 데이터를 채워 두는 용도.
    'movie-write': (vu, iter) => ({
        method: 'POST',
        path: '/movies',
        body: {
            title: `perf-movie-${Date.now()}-${vu}-${iter}-${Math.random().toString(36).slice(2, 8)}`
        }
    }),
    'movie-read-title-filter': () => ({
        method: 'GET',
        path: '/movies?page=1&size=50&title=perf-movie-17769404'
    }),
    health: () => ({ method: 'GET', path: '/health' })
}

const factory = SCENARIOS[scenario]
if (!factory) {
    throw new Error(`[perf] unknown scenario: ${scenario}`)
}

const baseHeaders = { accept: 'application/json' }
if (opts.acceptGzip) baseHeaders['Accept-Encoding'] = 'gzip'
// admin 가드 뒤의 쓰기 시나리오용. race-common과 같은 계약으로, env에 있으면 자동 부착한다.
if (__ENV.ADMIN_ACCESS_TOKEN) baseHeaders.authorization = `Bearer ${__ENV.ADMIN_ACCESS_TOKEN}`

export default function () {
    const spec = factory(__VU, __ITER)
    const headers = { ...baseHeaders }
    let body = null
    if (spec.body != null) {
        body = JSON.stringify(spec.body)
        headers['content-type'] = 'application/json'
    }

    const res = http.request(spec.method, `${opts.serverUrl}${spec.path}`, body, { headers })

    if (Date.now() >= startAt) {
        latency.add(res.timings.duration)
        statusCounter.add(1, { status: String(res.status) })
    }
}

export function handleSummary(data) {
    const summary = buildSummary({ data, scenario, opts })
    return summaryReturn({ summary, logTag: 'perf' })
}
