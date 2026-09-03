/**
 * `/users/refresh` 경로에 지속 부하를 걸어 측정하는 k6 하네스다.
 *
 * 정상 토큰 회전 한 번은 Redis를 네 번 왕복하고, 회전 전후에 MongoDB에서 authVersion을 확인한다.
 * bcrypt는 없고 JWT 서명 검증은 메모리 안에서 끝나므로, Redis와 계정 상태 조회가 결합된 경로의 처리량을 측정한다.
 *
 * VU마다 setup 단계에서 한 번씩 가입·로그인을 끝내고, 이후 자기 토큰을 회전한다.
 * 같은 토큰을 여러 VU가 동시에 회전시키면 무효화 경합이 일어나므로 토큰은 VU 단위로 분리한다.
 *
 * 환경 변수는 harness-crud.js와 같다: SERVER_URL, CONCURRENCY, DURATION_MS, WARMUP_MS, LABEL.
 */

import { sleep } from 'k6'
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

const latency = new Trend('measured_latency', true)
const statusCounter = new Counter('measured_status')

export const options = buildScenarioOptions(opts)

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' }

function uniqueEmail(vu) {
    return `perf-refresh.${vu}.${secureRandomHex()}@example.com`
}

export function setup() {
    const creds = []
    for (let vu = 1; vu <= opts.concurrency; vu++) {
        creds.push({ vu, email: uniqueEmail(vu), password: 'refreshpass' })
    }

    const createReqs = creds.map(({ vu, email, password }) => ({
        method: 'POST',
        url: `${opts.serverUrl}/users`,
        body: JSON.stringify({ name: `r${vu}`, email, password, birthDate: '1990-01-01' }),
        params: { headers: JSON_HEADERS }
    }))
    const createResponses = http.batch(createReqs)
    for (let i = 0; i < creds.length; i++) {
        if (createResponses[i].status !== 201) {
            throw new Error(`vu ${creds[i].vu} setup: create returned ${createResponses[i].status}`)
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
        const refreshToken = loginResponses[i].json('refreshToken')
        if (loginResponses[i].status !== 200 || !refreshToken) {
            throw new Error(`vu ${creds[i].vu} setup: login returned ${loginResponses[i].status}`)
        }
        accounts.push({ refreshToken })
    }
    return { accounts }
}

// VU별 회전 상태. 모듈 초기화는 VU마다 따로 일어나므로 격리된다.
let myRefreshToken = null
// 토큰이 무효화된 VU는 더 진행 불가다.
// k6는 VU를 도중에 멈출 수 없으니 플래그로 막아 추가 요청을 보내지 않는다.
let exhausted = false

export default function (data) {
    if (exhausted) {
        // CPU 폭주를 막기 위해 100ms씩 쉬며 측정 종료를 기다린다.
        sleep(0.1)
        return
    }

    if (!myRefreshToken) {
        myRefreshToken = data.accounts[__VU - 1].refreshToken
    }

    const res = http.post(
        `${opts.serverUrl}/users/refresh`,
        JSON.stringify({ refreshToken: myRefreshToken }),
        { headers: JSON_HEADERS }
    )

    if (exec.scenario.progress >= measurementStartProgress) {
        latency.add(res.timings.duration)
        statusCounter.add(1, { status: String(res.status) })
    }

    if (res.status === 200) {
        const next = res.json('refreshToken')
        if (next) {
            myRefreshToken = next
            return
        }
    }
    // 현재 실패 응답은 표본에 기록하고, 유효한 토큰이 없어 의미 없는 이후 요청만 중단한다.
    exhausted = true
}

export function handleSummary(data) {
    const summary = buildSummary({ data, scenario: 'user-refresh', opts })
    return summaryReturn({ summary, logTag: 'perf-refresh' })
}
