/**
 * api-race 스크립트들이 공유하는 헬퍼다.
 *
 * race 테스트는 시나리오마다 흐름이 다르지만 HTTP 호출 자체는 같은 패턴이다:
 *  - SERVER_URL 환경 변수 + 상대 경로로 호출
 *  - ADMIN_ACCESS_TOKEN이 env에 있으면 Authorization 헤더 자동 부착
 *  - 매 요청마다 새 Agent로 keepAlive=false로 보낸다(요청 단위 격리)
 *  - 응답은 {status, replicaId, body}로 반환. body는 JSON parse 시도 후 실패 시 raw 문자열.
 *
 * 시나리오 스크립트들이 각자 비슷한 함수를 7번 다시 구현하던 걸 여기로 모은다.
 */

const http = require('http')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'

/**
 * 잘못된 입력은 NaN으로 떨어뜨리지 않고 즉시 던져 의도된 값이 들어왔는지 확인한다.
 * 빈 문자열/미설정은 defaultValue로 떨어진다.
 */
function readPositiveInt(name, defaultValue) {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return defaultValue
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n <= 0 || String(n) !== raw.trim()) {
        throw new Error(`${name}는 양의 정수여야 한다. 받은 값: ${JSON.stringify(raw)}`)
    }
    return n
}

/**
 * HTTP 요청 하나를 보내고 응답을 정규화해 돌려준다.
 *
 * @param {string} method HTTP 메서드 (GET, POST, ...)
 * @param {string} path 상대 경로(쿼리 포함 가능). SERVER_URL과 합쳐 절대 URL이 된다.
 * @param {object} [opts]
 * @param {*}      [opts.body] 객체면 JSON으로 직렬화돼 application/json으로 보낸다. undefined면 body 없이 보낸다.
 * @param {object} [opts.headers] 추가/덮어쓸 헤더.
 * @returns {Promise<{status:number, replicaId:string|undefined, body:any}>}
 *   body는 JSON parse 성공 시 객체, 실패 시 raw 문자열, 빈 응답이면 null이다.
 */
function request(method, path, opts = {}) {
    const { body, headers } = opts
    const url = new URL(path, SERVER_URL)
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const agent = new http.Agent({ keepAlive: false })

    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                agent,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method,
                headers: {
                    'content-type': 'application/json',
                    ...(process.env.ADMIN_ACCESS_TOKEN
                        ? { authorization: `Bearer ${process.env.ADMIN_ACCESS_TOKEN}` }
                        : {}),
                    ...(payload === undefined
                        ? {}
                        : { 'content-length': Buffer.byteLength(payload) }),
                    ...(headers || {})
                }
            },
            (res) => {
                const chunks = []
                res.on('data', (c) => chunks.push(c))
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf8')
                    let parsed = null
                    if (raw) {
                        try {
                            parsed = JSON.parse(raw)
                        } catch {
                            // JSON이 아니면 raw 문자열을 그대로 돌려준다.
                            // 예: 일부 NGINX 에러 페이지, 빈 응답이 아닌 평문 응답.
                            parsed = raw
                        }
                    }
                    resolve({
                        status: res.statusCode,
                        replicaId: res.headers['x-replica-id'],
                        body: parsed
                    })
                    agent.destroy()
                })
            }
        )
        req.on('error', reject)
        if (payload !== undefined) req.write(payload)
        req.end()
    })
}

module.exports = { SERVER_URL, readPositiveInt, request }
