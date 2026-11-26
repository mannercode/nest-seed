import { randomBytes, randomInt } from 'node:crypto'
import http from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'

// race 시나리오는 runner.sh가 띄운 4-replica API 테스트 스택을 전제한다.
// 기본값으로 단일 dev 서버에 조용히 붙으면 경쟁이 재현되지 않아 결과가 왜곡되므로 필수로 받는다.
const SERVER_URL = process.env.SERVER_URL
if (!SERVER_URL) {
    throw new Error('SERVER_URL must be set (pnpm -C infra run race <scenario>로 실행한다)')
}

// 빈 값은 기본값을 쓰되 잘못된 입력은 즉시 거절한다.
function readPositiveInt(name, defaultValue, minimum = 1) {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return defaultValue
    const n = parseInt(raw, 10)
    if (!Number.isSafeInteger(n) || n < minimum || String(n) !== raw.trim()) {
        throw new Error(
            `${name}는 ${minimum} 이상의 정수여야 한다. 받은 값: ${JSON.stringify(raw)}`
        )
    }
    return n
}

const HTTP_REQUEST_TIMEOUT_MS = readPositiveInt('HTTP_REQUEST_TIMEOUT_MS', 120_000)

async function waitForAll(promises) {
    const results = await Promise.allSettled(promises)
    const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason)
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, errors[0].message)
    return results.map((result) => result.value)
}

function competingReplicas(responses, label) {
    const replicas = new Set(responses.map((response) => response.replicaId))
    if ([...replicas].some((id) => typeof id !== 'string' || !id.trim()) || replicas.size < 2) {
        throw new Error(
            `${label}: competing requests must identify at least two replicas (got ${[...replicas]})`
        )
    }
    return replicas.size
}

function responseDiagnostic({ replicaId, status, body }) {
    const diagnostic = { replicaId, status }
    // 성공한 로그인·갱신 응답에는 토큰이 있어 실패 응답의 본문만 기록한다.
    if (status >= 400 && body != null) diagnostic.error = JSON.stringify(body).slice(0, 200)
    return diagnostic
}

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
 * @param {AbortSignal} [opts.signal] 시나리오가 실패하면 진행 중인 요청도 취소한다.
 * @returns {Promise<{status:number, replicaId:string|undefined, body:any}>}
 *   body는 JSON parse 성공 시 객체, 실패 시 raw 문자열, 빈 응답이면 null이다.
 */
function request(method, path, opts = {}) {
    const { body, headers, signal } = opts
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
                    signal,
                    headers: {
                        'content-type': 'application/json',
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

/** predicate가 참이 될 때까지 폴링한다. 기한 안에 참이 되면 true, 넘기면 false. */
async function waitUntil(predicate, { timeoutMs, intervalMs = 50, signal } = {}) {
    const start = performance.now()
    while (true) {
        signal?.throwIfAborted()
        if (predicate()) return true
        if (performance.now() - start > timeoutMs) return false
        await delay(intervalMs, undefined, { signal })
    }
}

async function createAndLoginUser({ prefix, index }) {
    const email = `${prefix}.${index}.${secureRandomHex()}@example.com`
    const password = `${prefix} password 123`
    const created = await request('POST', '/users', {
        body: { name: `${prefix}-${index}`, birthDate: '1990-01-01', email, password }
    })
    if (created.status !== 201)
        throw new Error(`user create ${index}: ${JSON.stringify(responseDiagnostic(created))}`)

    const loggedIn = await request('POST', '/users/login', { body: { email, password } })
    if (loggedIn.status !== 200) {
        throw new Error(`user login ${index}: ${JSON.stringify(responseDiagnostic(loggedIn))}`)
    }

    return {
        userId: created.body.id,
        accessToken: loggedIn.body.accessToken,
        refreshToken: loggedIn.body.refreshToken
    }
}

// 인증 갱신은 경합을 시작하기 전에 끝낸다. 경합 중 401을 재시도로 숨기지 않는다.
async function refreshUserAccessTokens(users) {
    await waitForAll(
        users.map(async (user) => {
            const response = await request('POST', '/users/refresh', {
                body: { refreshToken: user.refreshToken }
            })
            if (response.status !== 200)
                throw new Error(`user refresh ${user.userId}: ${response.status}`)
            user.accessToken = response.body.accessToken
            user.refreshToken = response.body.refreshToken
        })
    )
}

export {
    SERVER_URL,
    competingReplicas,
    responseDiagnostic,
    waitForAll,
    createAndLoginUser,
    readPositiveInt,
    refreshUserAccessTokens,
    request,
    secureRandomHex,
    secureRandomIndex,
    waitUntil
}
