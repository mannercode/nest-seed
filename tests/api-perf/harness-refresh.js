/**
 * `/users/refresh` 경로에 지속 부하를 걸어 측정하는 k6 하네스다.
 *
 * 이 경로는 호출마다 Redis를 두 번 친다(이전 토큰 GET + 새 토큰 SET).
 * bcrypt도, 토큰 검증을 위한 DB 조회도 없고, JWT 검증은 메모리 안에서 끝난다.
 * 그래서 ioredis 클러스터 처리량을 가장 명확하게 측정한다.
 *
 * VU마다 setup 단계에서 한 번씩 가입·로그인을 끝내고, 이후 자기 토큰을 회전한다.
 * 같은 토큰을 여러 VU가 동시에 회전시키면 무효화 경합이 일어나므로 토큰은 VU 단위로 분리한다.
 *
 * 환경 변수는 harness.js와 같다: SERVER_URL, CONCURRENCY, DURATION_MS, WARMUP_MS, LABEL.
 */

import { sleep } from 'k6'
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
const startAt = measurementStart(opts)

const latency = new Trend('measured_latency', true)
const statusCounter = new Counter('measured_status')

export const options = buildScenarioOptions(opts)

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' }

function uniqueEmail(vu, seed) {
    return `perf-refresh.${seed}.${vu}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

/**
 * VU 수만큼 계정을 가입·로그인해 refresh token을 받아 둔다.
 * `http.batch`로 가입과 로그인을 각각 한 번에 보낸다. CONCURRENCY=100이면 가입 100건을
 * 병렬로 처리하고 결과를 모은 뒤 로그인 100건을 다시 병렬로 보낸다.
 * 결과 배열의 i번째 원소는 VU=i+1가 사용한다.
 */
export function setup() {
    const seed = Date.now()
    const creds = []
    for (let vu = 1; vu <= opts.concurrency; vu++) {
        creds.push({ vu, email: uniqueEmail(vu, seed), password: 'refreshpass' })
    }

    const createReqs = creds.map(({ vu, email, password }) => ({
        method: 'POST',
        url: `${opts.serverUrl}/users`,
        body: JSON.stringify({
            name: `r${vu}`,
            email,
            password,
            birthDate: '1990-01-01T00:00:00.000Z'
        }),
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
// 토큰이 무효화된 VU는 더 진행 불가다. 노드 하네스의 "워커 종료"에 대응한다.
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

    if (Date.now() >= startAt) {
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
    // 200이 아니거나 새 토큰이 없으면 이후 회차는 의미가 없다. 표본에서 빼고 멈춘다.
    exhausted = true
}

export function handleSummary(data) {
    const summary = buildSummary({ data, scenario: 'user-refresh', opts })
    return summaryReturn({ summary, logTag: 'perf-refresh' })
}
