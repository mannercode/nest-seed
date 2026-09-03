/**
 * 사용자 이름 필터 전용 k6 성능 하네스다.
 *
 * `GET /users`가 JWT로 보호되므로 VU마다 자체 계정을 가입·로그인하고, 받은 액세스 토큰으로
 * `?name=<filter>` 쿼리를 반복 실행한다.
 *
 * 부분 문자열 정규식은 일반 인덱스를 활용하지 못해 컬렉션 전체를 스캔한다.
 * 검색어를 좁게 설정해 매치 수를 거의 0으로 맞추고, 그 비용을 단독으로 측정한다.
 *
 * 환경 변수: SERVER_URL, CONCURRENCY, DURATION_MS, WARMUP_MS, LABEL, FILTER_PREFIX.
 */

import http from 'k6/http'
import exec from 'k6/execution'
import { Counter, Trend } from 'k6/metrics'
import {
    buildScenarioOptions,
    buildSummary,
    readOptions,
    secureRandomHex,
    summaryReturn
} from './perf-common.js'

const opts = readOptions()
const measurementStartProgress = opts.warmupMs / (opts.warmupMs + opts.durationMs)

const FILTER_PREFIX = __ENV.FILTER_PREFIX || 'perf-user-17769404'
const requestPath = `/users?page=1&size=50&name=${encodeURIComponent(FILTER_PREFIX)}`

const latency = new Trend('measured_latency', true)
const statusCounter = new Counter('measured_status')

export const options = buildScenarioOptions(opts)

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' }

export function setup() {
    const creds = []
    for (let vu = 1; vu <= opts.concurrency; vu++) {
        creds.push({
            vu,
            email: `perf-user-filter.${vu}.${secureRandomHex()}@example.com`,
            password: 'filterprobepass'
        })
    }

    const createReqs = creds.map(({ vu, email, password }) => ({
        method: 'POST',
        url: `${opts.serverUrl}/users`,
        body: JSON.stringify({ name: `probe-${vu}`, email, password, birthDate: '1990-01-01' }),
        params: { headers: JSON_HEADERS }
    }))
    const createResponses = http.batch(createReqs)
    for (let i = 0; i < creds.length; i++) {
        if (createResponses[i].status !== 201) {
            throw new Error(`vu ${creds[i].vu} create returned ${createResponses[i].status}`)
        }
    }

    const loginReqs = creds.map(({ email, password }) => ({
        method: 'POST',
        url: `${opts.serverUrl}/users/login`,
        body: JSON.stringify({ email, password }),
        params: { headers: JSON_HEADERS }
    }))
    const loginResponses = http.batch(loginReqs)
    const accounts = []
    for (let i = 0; i < creds.length; i++) {
        const accessToken = loginResponses[i].json('accessToken')
        if (loginResponses[i].status !== 200 || !accessToken) {
            throw new Error(`vu ${creds[i].vu} login returned ${loginResponses[i].status}`)
        }
        accounts.push({ authHeader: `Bearer ${accessToken}` })
    }
    return { accounts }
}

let myAuthHeader = null

export default function (data) {
    if (!myAuthHeader) {
        myAuthHeader = data.accounts[__VU - 1].authHeader
    }

    const res = http.get(`${opts.serverUrl}${requestPath}`, {
        headers: { accept: 'application/json', authorization: myAuthHeader }
    })

    if (exec.scenario.progress >= measurementStartProgress) {
        latency.add(res.timings.duration)
        statusCounter.add(1, { status: String(res.status) })
    }
}

export function handleSummary(data) {
    const summary = buildSummary({
        data,
        scenario: 'user-read-name-filter',
        opts,
        extra: { filterPrefix: FILTER_PREFIX }
    })
    return summaryReturn({ summary, logTag: 'user-filter' })
}
