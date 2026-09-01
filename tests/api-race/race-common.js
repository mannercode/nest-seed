const http = require('http')
const { randomBytes, randomInt } = require('node:crypto')

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

const HTTP_REQUEST_TIMEOUT_MS = readPositiveInt('HTTP_REQUEST_TIMEOUT_MS', 30_000)
const SSE_HANDSHAKE_TIMEOUT_MS = readPositiveInt('SSE_HANDSHAKE_TIMEOUT_MS', 30_000)

function secureRandomHex(byteLength = 16) {
    return randomBytes(byteLength).toString('hex')
}

function secureRandomIndex(length) {
    if (!Number.isSafeInteger(length) || length <= 0) {
        throw new Error('length must be a positive safe integer')
    }
    return randomInt(length)
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
    const requestPath = url.pathname + url.search
    const diagnostic = `HTTP ${method.toUpperCase()} ${requestPath}`

    return new Promise((resolve, reject) => {
        let req
        let res
        let settled = false
        let deadline

        const destroy = () => {
            if (deadline) clearTimeout(deadline)
            if (res && !res.destroyed) res.destroy()
            if (req && !req.destroyed) req.destroy()
            agent.destroy()
        }
        const fail = (error) => {
            if (settled) return
            settled = true
            destroy()
            reject(error)
        }
        const succeed = (value) => {
            if (settled) return
            settled = true
            if (deadline) clearTimeout(deadline)
            agent.destroy()
            resolve(value)
        }

        // 소켓 inactivity가 아니라 요청 시작부터 응답 body 종료까지의 절대 기한이다.
        // 상대가 조금씩 데이터를 보내며 연결만 붙들어도 이 타이머는 연장되지 않는다.
        deadline = setTimeout(
            () => fail(new Error(`${diagnostic} timed out after ${HTTP_REQUEST_TIMEOUT_MS}ms`)),
            HTTP_REQUEST_TIMEOUT_MS
        )

        try {
            req = http.request(
                {
                    agent,
                    hostname: url.hostname,
                    port: url.port,
                    path: requestPath,
                    method,
                    headers: {
                        'content-type': 'application/json',
                        ...(process.env.ADMIN_ACCESS_TOKEN
                            ? { authorization: `Bearer ${process.env.ADMIN_ACCESS_TOKEN}` }
                            : {}),
                        ...(payload === undefined
                            ? {}
                            : { 'content-length': Buffer.byteLength(payload) }),
                        ...headers
                    }
                },
                (incoming) => {
                    res = incoming
                    const chunks = []
                    res.on('data', (c) => chunks.push(c))
                    res.once('aborted', () => fail(new Error(`${diagnostic} response aborted`)))
                    res.once('error', fail)
                    res.once('end', () => {
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
                        succeed({
                            status: res.statusCode,
                            replicaId: res.headers['x-replica-id'],
                            body: parsed
                        })
                    })
                }
            )
            req.once('error', fail)
            if (payload !== undefined) req.write(payload)
            req.end()
        } catch (error) {
            fail(error)
        }
    })
}

/**
 * `/showtime-creation/event-stream` SSE 연결 하나를 열고, 도착하는 이벤트를 파싱해 `events`에 쌓는다.
 *
 * SSE 프레임은 `\n\n`으로 구분되고, 각 프레임에서 `data:` 줄만 JSON으로 파싱한다.
 * keepalive 주석처럼 `data:`가 없는 프레임은 건너뛴다.
 *
 * @param {object} [opts]
 * @param {string} [opts.label] 상태 코드·handshake 에러 진단에 붙일 식별자.
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
    const requestPath = url.pathname + url.search
    const diagnostic = `SSE GET ${requestPath}${label ? ` [${label}]` : ''}`
    let replicaId
    let closed = false
    let req
    let res
    let handshakeSettled = false
    let handshakeDeadline
    let rejectConnected

    const destroy = () => {
        if (handshakeDeadline) clearTimeout(handshakeDeadline)
        if (res && !res.destroyed) res.destroy()
        if (req && !req.destroyed) req.destroy()
        agent.destroy()
    }
    const failHandshake = (error) => {
        if (handshakeSettled) return
        handshakeSettled = true
        destroy()
        rejectConnected(error)
    }

    const connected = new Promise((resolve, reject) => {
        rejectConnected = reject
        handshakeDeadline = setTimeout(
            () =>
                failHandshake(
                    new Error(
                        `${diagnostic} handshake timed out after ${SSE_HANDSHAKE_TIMEOUT_MS}ms`
                    )
                ),
            SSE_HANDSHAKE_TIMEOUT_MS
        )

        try {
            req = http.request(
                {
                    agent,
                    hostname: url.hostname,
                    port: url.port,
                    path: requestPath,
                    method: 'GET',
                    headers: {
                        accept: 'text/event-stream',
                        ...(process.env.ADMIN_ACCESS_TOKEN
                            ? { authorization: `Bearer ${process.env.ADMIN_ACCESS_TOKEN}` }
                            : {})
                    }
                },
                (incoming) => {
                    if (handshakeSettled) {
                        incoming.destroy()
                        return
                    }
                    res = incoming
                    if (res.statusCode !== 200) {
                        failHandshake(new Error(`${diagnostic} status ${res.statusCode}`))
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
                            const dataLine = frame
                                .split('\n')
                                .find((line) => line.startsWith('data:'))
                            if (!dataLine) continue
                            const payload = dataLine.slice('data:'.length).trim()
                            try {
                                events.push(JSON.parse(payload))
                            } catch (e) {
                                if (onParseError) onParseError(payload, e)
                            }
                        }
                    })
                    res.once('error', failHandshake)
                    handshakeSettled = true
                    clearTimeout(handshakeDeadline)
                    resolve({ res, req })
                }
            )
            req.once('error', failHandshake)
            req.end()
        } catch (error) {
            failHandshake(error)
        }
    })

    const close = async () => {
        closed = true
        if (!handshakeSettled) {
            failHandshake(new Error(`${diagnostic} closed before handshake completed`))
        } else {
            destroy()
        }
        try {
            await connected
        } catch {
            // 연결 자체가 실패했으면 정리할 스트림이 없다.
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

/** 사가의 영속 상태를 조회해 완료를 기다린다. SSE 전달 자체는 sse-fanout-race가 검증한다. */
async function waitForSagaSuccess(sagaId, deadlineMs) {
    const path = `/showtime-creation/showtimes/${encodeURIComponent(sagaId)}/status`
    const deadline = Date.now() + deadlineMs
    let latestStatus = 'unknown'

    while (Date.now() <= deadline) {
        const response = await request('GET', path)
        if (response.status !== 200) {
            throw new Error(`saga ${sagaId} status query returned HTTP ${response.status}`)
        }

        latestStatus = response.body?.status
        if (latestStatus === 'succeeded') return
        if (latestStatus === 'failed' || latestStatus === 'error') {
            throw new Error(`saga ${sagaId} status=${latestStatus}`)
        }
        if (latestStatus !== 'pending') {
            throw new Error(`saga ${sagaId} returned invalid status=${String(latestStatus)}`)
        }

        const remainingMs = deadline - Date.now()
        if (remainingMs <= 0) break
        await new Promise((resolve) => setTimeout(resolve, Math.min(100, remainingMs)))
    }

    throw new Error(
        `saga ${sagaId} did not finish in ${deadlineMs}ms (last status=${latestStatus})`
    )
}

async function createPublishedMovieAndTheater({ label, seatCount }) {
    const movie = await request('POST', '/movies', {
        body: {
            title: label,
            genres: ['action'],
            releaseDate: '2024-01-01',
            plot: 'plot',
            durationInSeconds: 7200,
            director: 'director',
            rating: 'PG',
            assetIds: []
        }
    })
    if (movie.status !== 201) throw new Error(`movie: ${movie.status}`)

    const publish = await request('POST', `/movies/${movie.body.id}/publish`)
    if (publish.status !== 200 && publish.status !== 201) {
        throw new Error(`publish: ${publish.status}`)
    }

    const theater = await request('POST', '/theaters', {
        body: {
            name: label,
            location: { latitude: 37.5665, longitude: 126.978 },
            seatmap: {
                blocks: [{ name: 'A', rows: [{ name: '1', layout: 'O'.repeat(seatCount) }] }]
            }
        }
    })
    if (theater.status !== 201) throw new Error(`theater: ${theater.status}`)

    return { movieId: movie.body.id, theaterId: theater.body.id }
}

async function createShowtimeWithTickets({
    movieId,
    theaterId,
    startTimeOffsetMs,
    minimumTicketCount,
    deadlineMs
}) {
    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000 + startTimeOffsetMs)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z')
    const created = await request('POST', '/showtime-creation/showtimes', {
        body: { movieId, theaterIds: [theaterId], durationInMinutes: 120, startTimes: [startTime] },
        headers: { 'idempotency-key': secureRandomHex() }
    })
    if (created.status !== 202) throw new Error(`showtime: ${created.status}`)
    await waitForSagaSuccess(created.body.sagaId, deadlineMs)

    const search = await request('POST', '/showtime-creation/showtimes/search', {
        body: { theaterIds: [theaterId] }
    })
    if (search.status !== 200 || !Array.isArray(search.body) || search.body.length === 0) {
        throw new Error(`showtimes search: ${search.status}`)
    }
    const showtime = search.body.find((candidate) => candidate.startTime === startTime)
    if (!showtime) {
        throw new Error(`showtimes search: no showtime with startTime ${startTime}`)
    }

    const tickets = await request('GET', `/booking/showtimes/${showtime.id}/tickets`)
    if (tickets.status !== 200 || !Array.isArray(tickets.body)) {
        throw new Error(`tickets: ${tickets.status}`)
    }
    if (tickets.body.length < minimumTicketCount) {
        throw new Error(`tickets: need ${minimumTicketCount}, got ${tickets.body.length}`)
    }

    return { showtimeId: showtime.id, ticketIds: tickets.body.map((ticket) => ticket.id) }
}

async function createAndLoginUser({ prefix, index }) {
    const email = `${prefix}.${Date.now()}.${index}.${secureRandomHex()}@example.com`
    const password = `${prefix}password`
    const created = await request('POST', '/users', {
        body: { name: `${prefix}-${index}`, birthDate: '1990-01-01', email, password }
    })
    if (created.status !== 201) throw new Error(`user create ${index}: ${created.status}`)

    const loggedIn = await request('POST', '/users/login', { body: { email, password } })
    if (loggedIn.status !== 200 && loggedIn.status !== 201) {
        throw new Error(`user login ${index}: ${loggedIn.status}`)
    }

    return {
        userId: created.body.id,
        accessToken: loggedIn.body.accessToken,
        refreshToken: loggedIn.body.refreshToken
    }
}

module.exports = {
    SERVER_URL,
    createAndLoginUser,
    createPublishedMovieAndTheater,
    createShowtimeWithTickets,
    readPositiveInt,
    request,
    secureRandomHex,
    secureRandomIndex,
    openEventStream,
    waitUntil,
    waitForSagaSuccess
}
