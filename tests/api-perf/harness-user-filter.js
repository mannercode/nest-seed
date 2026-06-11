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
import { Counter, Trend } from 'k6/metrics'
import {
    buildScenarioOptions,
    buildSummary,
    measurementStart,
    readOptions,
    summaryReturn
} from './perf-common.js'

const opts = readOptions()

// 부분 문자열을 좁게 설정해 매치 수를 거의 0으로 맞춘다.
// 그래야 기준값 측정이 회차마다 같은 조건에서 나온다.
const FILTER_PREFIX = __ENV.FILTER_PREFIX || 'perf-user-17769404'
const requestPath = `/users?page=1&size=50&name=${encodeURIComponent(FILTER_PREFIX)}`

const latency = new Trend('measured_latency', true)
const statusCounter = new Counter('measured_status')

export const options = buildScenarioOptions(opts)

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' }

export function setup() {
    const seed = Date.now()
    const creds = []
    for (let vu = 1; vu <= opts.concurrency; vu++) {
        creds.push({
            vu,
            email: `perf-user-filter.${seed}.${vu}@example.com`,
            password: 'filterprobepass'
        })
    }

    const createReqs = creds.map(({ vu, email, password }) => ({
        method: 'POST',
        url: `${opts.serverUrl}/users`,
        body: JSON.stringify({
            name: `probe-${vu}`,
            email,
            password,
            birthDate: '1990-01-01T00:00:00.000Z'
        }),
        params: { headers: JSON_HEADERS }
    }))
    const createResponses = http.batch(createReqs)
    for (let i = 0; i < creds.length; i++) {
        // seed가 매 회차마다 다르므로(`Date.now()`) 이메일은 항상 unique하다.
        // 409가 떴다면 무언가 비정상(같은 ms에 두 번 시작 등)이라 그대로 던진다.
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
    // 측정 창은 setup 종료 기준이다. VU init 기준이면 setup의 가입·로그인(bcrypt)이 워밍업을 잠식한다.
    return { accounts, startAt: measurementStart(opts) }
}

let myAuthHeader = null

export default function (data) {
    if (!myAuthHeader) {
        myAuthHeader = data.accounts[__VU - 1].authHeader
    }

    const res = http.get(`${opts.serverUrl}${requestPath}`, {
        headers: { accept: 'application/json', authorization: myAuthHeader }
    })

    if (Date.now() >= data.startAt) {
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
