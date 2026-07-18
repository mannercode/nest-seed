const http = require('http')

// race 시나리오는 runner.sh가 띄운 4-replica 배포 스택을 전제한다.
// 기본값으로 단일 dev 서버에 조용히 붙으면 경쟁이 재현되지 않아 결과가 왜곡되므로 필수로 받는다.
const SERVER_URL = process.env.SERVER_URL
if (!SERVER_URL) {
    throw new Error('SERVER_URL must be set (bash tests/api-race/runner.sh <scenario>로 실행한다)')
}

// 빈 값은 기본값을 쓰되 잘못된 입력은 즉시 거절한다.
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
        req.on('error', (err) => {
            // 정상 경로는 end 콜백에서 destroy한다. 에러 경로도 대칭으로 정리한다.
            agent.destroy()
            reject(err)
        })
        if (payload !== undefined) req.write(payload)
        req.end()
    })
}

/**
 * `/showtime-creation/event-stream` SSE 연결 하나를 열고, 도착하는 이벤트를 파싱해 `events`에 쌓는다.
 *
 * SSE 프레임은 `\n\n`으로 구분되고, 각 프레임에서 `data:` 줄만 JSON으로 파싱한다.
 * keepalive 주석처럼 `data:`가 없는 프레임은 건너뛴다.
 *
 * @param {object} [opts]
 * @param {string} [opts.label] 상태 코드 에러 메시지에 붙일 식별자.
 * @param {(payload:string, err:Error)=>void} [opts.onParseError]
 *   `data:` 페이로드가 JSON이 아닐 때 호출된다. 없으면 무시한다.
 *   엄격 모드가 필요한 시나리오는 여기서 throw해 깨진 페이로드를 즉시 드러낸다.
 * @returns {{events:any[], connected:Promise<any>, close:()=>Promise<void>, getReplicaId:()=>string|undefined}}
 */
function openEventStream(opts = {}) {
    const { label, onParseError } = opts
    const url = new URL('/showtime-creation/event-stream', SERVER_URL)
    const agent = new http.Agent({ keepAlive: false })
    const events = []
    let replicaId
    let closed = false

    const connected = new Promise((resolve, reject) => {
        const req = http.request(
            {
                agent,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'GET',
                headers: {
                    accept: 'text/event-stream',
                    ...(process.env.ADMIN_ACCESS_TOKEN
                        ? { authorization: `Bearer ${process.env.ADMIN_ACCESS_TOKEN}` }
                        : {})
                }
            },
            (res) => {
                if (res.statusCode !== 200) {
                    reject(
                        new Error(
                            `event-stream${label ? ` ${label}` : ''} status ${res.statusCode}`
                        )
                    )
                    return
                }
                replicaId = res.headers['x-replica-id']
                res.setEncoding('utf8')
                let buffer = ''
                res.on('data', (chunk) => {
                    if (closed) return
                    buffer += chunk
                    let idx
                    while ((idx = buffer.indexOf('\n\n')) !== -1) {
                        const frame = buffer.slice(0, idx)
                        buffer = buffer.slice(idx + 2)
                        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
                        if (!dataLine) continue
                        const payload = dataLine.slice('data:'.length).trim()
                        try {
                            events.push(JSON.parse(payload))
                        } catch (e) {
                            if (onParseError) onParseError(payload, e)
                        }
                    }
                })
                res.on('error', reject)
                resolve({ res, req })
            }
        )
        req.on('error', reject)
        req.end()
    })

    const close = async () => {
        closed = true
        try {
            const { res, req } = await connected
            res.destroy()
            req.destroy()
        } catch {
            // 연결 자체가 실패했으면 정리할 스트림이 없다.
        } finally {
            agent.destroy()
        }
    }

    return { events, connected, close, getReplicaId: () => replicaId }
}

/** predicate가 참이 될 때까지 폴링한다. 기한 안에 참이 되면 true, 넘기면 false. */
async function waitUntil(predicate, { timeoutMs, intervalMs = 50 } = {}) {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) return false
        await new Promise((r) => setTimeout(r, intervalMs))
    }
    return true
}

/**
 * 사가 하나가 끝날 때까지 SSE를 열어 두고 기다린다.
 * succeeded면 정상 종료, failed/error면 throw, 기한을 넘겨도 throw한다.
 * 호출마다 새 연결을 연다(시나리오들의 회차당 1연결과 동일).
 */
async function waitForSagaSuccess(sagaId, deadlineMs) {
    const stream = openEventStream()
    await stream.connected
    const terminal = ['succeeded', 'failed', 'error']
    const outcome = () =>
        stream.events.find((e) => e && e.sagaId === sagaId && terminal.includes(e.status))
    try {
        const ok = await waitUntil(() => Boolean(outcome()), { timeoutMs: deadlineMs })
        if (!ok) throw new Error(`saga ${sagaId} did not finish in ${deadlineMs}ms`)
        const evt = outcome()
        if (evt.status !== 'succeeded') throw new Error(`saga ${sagaId} status=${evt.status}`)
    } finally {
        await stream.close().catch(() => {})
    }
}

module.exports = {
    SERVER_URL,
    readPositiveInt,
    request,
    openEventStream,
    waitUntil,
    waitForSagaSuccess
}
