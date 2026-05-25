/**
 * 사용자 이름 필터 전용 성능 하네스이다.
 *
 * `GET /users`가 JWT로 보호되므로 워커마다 자체 계정을 가입·로그인하고, 받은 액세스 토큰으로
 * `?name=<filter>` 쿼리를 반복 실행한다.
 *
 * 부분 문자열 정규식은 일반 인덱스를 활용하지 못해 컬렉션 전체를 스캔한다.
 * 검색어를 좁게 설정해 매치 수를 거의 0으로 맞추고, 그 비용을 단독으로 측정한다.
 *
 * 환경 변수: SERVER_URL, CONCURRENCY, DURATION_MS, WARMUP_MS, LABEL, FILTER_PREFIX.
 */

const { runPerf, readOptions, doRequest } = require('./perf-common')

// 부분 문자열을 좁게 설정해 매치 수를 거의 0으로 맞춘다.
// 그래야 기준값 측정이 회차마다 같은 조건에서 나온다.
const FILTER_PREFIX = process.env.FILTER_PREFIX || 'perf-user-17769404'

async function setupWorker({ workerId, seed, urlObj, agent }) {
    const email = `perf-user-filter.${seed}.${workerId}@example.com`
    const password = 'filterprobepass'

    const create = await doRequest({
        agent,
        urlObj,
        method: 'POST',
        requestPath: '/users',
        body: { name: `probe-${workerId}`, email, password, birthDate: '1990-01-01T00:00:00.000Z' }
    })
    if (create.status !== 201 && create.status !== 409) {
        agent.destroy()
        throw new Error(`worker ${workerId} create returned ${create.status}`)
    }

    const login = await doRequest({
        agent,
        urlObj,
        method: 'POST',
        requestPath: '/users/login',
        body: { email, password }
    })
    if (login.status !== 200 || !login.body || !login.body.accessToken) {
        agent.destroy()
        throw new Error(`worker ${workerId} login returned ${login.status}`)
    }

    return { agent, authHeader: `Bearer ${login.body.accessToken}` }
}

const requestPath = `/users?page=1&size=50&name=${encodeURIComponent(FILTER_PREFIX)}`

runPerf({
    scenario: 'user-read-name-filter',
    logTag: 'user-filter',
    options: readOptions(),
    extraSummary: { filterPrefix: FILTER_PREFIX },
    setupWorker,
    perRequest: (state) => ({
        method: 'GET',
        path: requestPath,
        headers: { authorization: state.authHeader }
    })
}).catch((e) => {
    console.error('[user-filter] error:', e)
    process.exit(1)
})
