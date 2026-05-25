/**
 * `/users/refresh` 경로에 지속 부하를 걸어 측정하는 하네스이다.
 *
 * 이 경로는 호출마다 Redis를 두 번 친다(이전 토큰 GET + 새 토큰 SET).
 * bcrypt도, 토큰 검증을 위한 DB 조회도 없고, JWT 검증은 메모리 안에서 끝난다.
 * 그래서 ioredis 클러스터 처리량을 가장 명확하게 측정한다.
 *
 * 워커마다 측정 전 한 번씩 가입·로그인을 끝내고, 이후 자기 토큰을 회전한다.
 * 같은 토큰을 여러 워커가 동시에 회전시키면 무효화 경합이 일어나므로 토큰은 워커 단위로 분리한다.
 *
 * 환경 변수는 harness.js와 같다: SERVER_URL, CONCURRENCY, DURATION_MS, WARMUP_MS, LABEL.
 */

const { runPerf, readOptions, doRequest } = require('./perf-common')

function uniqueEmail(workerId, seed) {
    return `perf-refresh.${seed}.${workerId}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function setupWorker({ workerId, seed, urlObj, agent }) {
    const email = uniqueEmail(workerId, seed)
    const password = 'refreshpass'

    const create = await doRequest({
        agent,
        urlObj,
        method: 'POST',
        requestPath: '/users',
        body: { name: `r${workerId}`, email, password, birthDate: '1990-01-01T00:00:00.000Z' }
    })
    if (create.status !== 201) {
        agent.destroy()
        throw new Error(`worker ${workerId} setup: create returned ${create.status}`)
    }

    const login = await doRequest({
        agent,
        urlObj,
        method: 'POST',
        requestPath: '/users/login',
        body: { email, password }
    })
    if (login.status !== 200 || !login.body || !login.body.refreshToken) {
        agent.destroy()
        throw new Error(`worker ${workerId} setup: login returned ${login.status}`)
    }

    return { agent, refreshToken: login.body.refreshToken }
}

runPerf({
    scenario: 'user-refresh',
    logTag: 'perf-refresh',
    options: readOptions(),
    setupWorker,
    perRequest: (state) => ({
        method: 'POST',
        path: '/users/refresh',
        body: { refreshToken: state.refreshToken }
    }),
    onResponse: (state, result) => {
        if (result.status === 200 && result.body && result.body.refreshToken) {
            state.refreshToken = result.body.refreshToken
            return false
        }
        // 토큰이 무효화된 경우. 워커가 서로 격리되면 일어나지 않아야 하지만,
        // 같은 사용자 토큰에 동시 리프레시가 들어오면 발생한다. 이 워커는 종료한다.
        return result.status !== 200
    }
}).catch((e) => {
    console.error('[perf-refresh] error:', e)
    process.exit(1)
})
