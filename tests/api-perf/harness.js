/**
 * API 스택에 지속 부하를 걸어 시나리오별 처리량과 응답 시간 분위수를 측정하는 하네스이다.
 *
 * 결과는 stdout 마지막 줄에 JSON 한 줄로 출력하고, 사람이 읽을 요약은 stderr에 출력한다.
 * 원본 결과는 `_output/perf/<scenario>-<timestamp>.json`에 저장한다.
 *
 * 환경 변수:
 *  SERVER_URL    - 대상 서버 (기본 http://localhost:3000)
 *  SCENARIO      - user-write | user-read | theater-write | theater-read | ... (기본 user-write)
 *  CONCURRENCY   - 동시 요청 수 (기본 100)
 *  DURATION_MS   - 측정 시간 ms (기본 30000)
 *  WARMUP_MS     - 워밍업 시간 ms (기본 3000)
 *  LABEL         - 결과에 같이 저장할 자유 태그 (기본 '')
 *  ACCEPT_GZIP   - '1'이면 `Accept-Encoding: gzip` 헤더 추가 (기본 미설정)
 */

const { runPerf, readOptions } = require('./perf-common')

const SCENARIO = process.env.SCENARIO || 'user-write'

function uniqueEmail(workerId, seq) {
    return `perf.${Date.now()}.${workerId}.${seq}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

const SCENARIOS = {
    'user-write': (workerId, seq) => ({
        method: 'POST',
        path: '/users',
        body: {
            name: `perf-${workerId}-${seq}`,
            email: uniqueEmail(workerId, seq),
            password: 'perfpassword',
            birthDate: '1990-01-01T00:00:00.000Z'
        }
    }),
    // `GET /users`는 JWT가 필요하다.
    // 이 시나리오가 재는 것은 인증 실패 응답의 처리량이다.
    // 인증 없이 Mongo 읽기를 측정하고 싶으면 theater-read나 movie-read 시나리오를 쓴다.
    'user-read': () => ({ method: 'GET', path: '/users?take=50' }),
    // `POST /theaters`는 가드가 없어서 순수 Mongo 쓰기 + majority commit 비용만 잰다.
    // 본문은 작지만 중첩 검증이 있어서 무시할 비용은 아니다.
    'theater-write': (workerId, seq) => ({
        method: 'POST',
        path: '/theaters',
        body: {
            name: `perf-theater-${Date.now()}-${workerId}-${seq}-${Math.random().toString(36).slice(2, 8)}`,
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
    // 그 비용을 단독으로 측정하는 시나리오이다.
    'theater-read-name-filter': () => ({
        method: 'GET',
        path: '/theaters?page=1&size=50&name=perf-theater-17769404'
    }),
    'movie-read': () => ({ method: 'GET', path: '/movies?page=1&size=50' }),
    // 순수 Mongo 쓰기 (bcrypt 없음). 필터 측정 전에 데이터를 채워 두는 용도.
    'movie-write': (workerId, seq) => ({
        method: 'POST',
        path: '/movies',
        body: {
            title: `perf-movie-${Date.now()}-${workerId}-${seq}-${Math.random().toString(36).slice(2, 8)}`
        }
    }),
    'movie-read-title-filter': () => ({
        method: 'GET',
        path: '/movies?page=1&size=50&title=perf-movie-17769404'
    }),
    health: () => ({ method: 'GET', path: '/health' })
}

const opts = readOptions()
const factory = SCENARIOS[SCENARIO]
if (!factory) {
    console.error(`[perf] unknown scenario: ${SCENARIO}`)
    process.exit(1)
}

const acceptGzipHeaders = opts.acceptGzip ? { 'accept-encoding': 'gzip' } : undefined

runPerf({
    scenario: SCENARIO,
    logTag: 'perf',
    options: opts,
    perRequest: (_state, workerId, seq) => {
        const req = factory(workerId, seq)
        return { ...req, headers: acceptGzipHeaders }
    }
}).catch((e) => {
    console.error('[perf] error:', e)
    process.exit(1)
})
