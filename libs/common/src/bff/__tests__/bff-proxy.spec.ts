import { JwtService } from '@nestjs/jwt'
import { createBffProxy } from '../index.js'

type ProxyOptions = Parameters<typeof createBffProxy>[0]
type Proxy = ReturnType<typeof createBffProxy>
type RequestOptions = RequestInit & { cookies?: Record<string, string> }

const ACCESS_COOKIE = 'test-access'
const REFRESH_COOKIE = 'test-refresh'
const SESSION = { [ACCESS_COOKIE]: 'old-access', [REFRESH_COOKIE]: 'old-refresh' }
const ACCESS_EXPIRY = 4_102_444_800
const REFRESH_EXPIRY = ACCESS_EXPIRY + 7 * 24 * 60 * 60
const tokens = {
    accessToken: new JwtService().sign({ exp: ACCESS_EXPIRY }, { secret: 'test-access-secret' }),
    refreshToken: new JwtService().sign({ exp: REFRESH_EXPIRY }, { secret: 'test-refresh-secret' })
}

function createProxy(options: Partial<ProxyOptions> = {}) {
    return createBffProxy({
        accessCookie: ACCESS_COOKIE,
        refreshCookie: REFRESH_COOKIE,
        authPrefix: 'users',
        apiBaseUrl: () => 'https://api.test',
        secureCookies: false,
        trustProxyHeaders: false,
        ...options
    })
}

function invoke(proxy: Proxy, path: string, { cookies = {}, ...init }: RequestOptions = {}) {
    const requestInit = { ...init, duplex: 'half' as const }
    const request = Object.assign(new Request(`https://web.test/api/${path}`, requestInit), {
        cookies: {
            get: (name: string) =>
                cookies[name] === undefined ? undefined : { value: cookies[name] }
        }
    })
    const segments = path.split('?')[0]!.split('/').map(decodeURIComponent)
    return proxy(request, { params: Promise.resolve({ path: segments }) })
}

function expectSessionCookies(response: Response, secure = false) {
    const suffix = secure ? '; Secure' : ''
    expect(response.headers.getSetCookie()).toEqual([
        `${ACCESS_COOKIE}=${tokens.accessToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(ACCESS_EXPIRY * 1000).toUTCString()}${suffix}`,
        `${REFRESH_COOKIE}=${tokens.refreshToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(REFRESH_EXPIRY * 1000).toUTCString()}${suffix}`
    ])
}

function expectClearedCookies(response: Response) {
    expect(response.headers.getSetCookie()).toEqual([
        `${ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
        `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    ])
}

describe('createBffProxy', () => {
    let upstream: ReturnType<typeof vi.fn<typeof fetch>>

    beforeEach(() => {
        upstream = vi.fn<typeof fetch>().mockRejectedValue(new Error('Unexpected upstream request'))
        vi.stubGlobal('fetch', upstream)
    })
    afterEach(() => vi.unstubAllGlobals())

    describe('요청과 응답 전달', () => {
        it.each(['https://api.test/v1', 'https://api.test/v1/'])(
            'API 주소 %s 아래로 경로·쿼리·허용 헤더와 본문을 전달한다',
            async (apiBaseUrl) => {
                upstream.mockResolvedValue(
                    Response.json(
                        { id: 'movie-id' },
                        {
                            status: 201,
                            headers: {
                                Location: '/movies/movie-id',
                                'Retry-After': '2',
                                'Set-Cookie': 'upstream=private'
                            }
                        }
                    )
                )
                const proxy = createProxy({ apiBaseUrl: () => apiBaseUrl, trustProxyHeaders: true })
                const response = await invoke(proxy, 'movies/a%2Fb?title=a%20b', {
                    method: 'POST',
                    cookies: SESSION,
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'Idempotency-Key': 'request-id',
                        Authorization: 'Bearer client-controlled',
                        Cookie: 'secret=client-cookie',
                        'X-Forwarded-For': '198.51.100.1, 203.0.113.2',
                        Host: 'web.test',
                        Origin: 'https://web.test'
                    },
                    body: '{"title":"sample"}'
                })

                const [url, init] = upstream.mock.calls[0]!
                expect(String(url)).toBe('https://api.test/v1/movies/a%2Fb?title=a%20b')
                expect(init).toMatchObject({
                    method: 'POST',
                    cache: 'no-store',
                    redirect: 'manual'
                })
                expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
                    accept: 'application/json',
                    authorization: 'Bearer old-access',
                    'content-type': 'application/json',
                    'idempotency-key': 'request-id',
                    'x-forwarded-for': '203.0.113.2'
                })
                expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe(
                    '{"title":"sample"}'
                )
                expect(response.status).toBe(201)
                await expect(response.json()).resolves.toEqual({ id: 'movie-id' })
                expect(Object.fromEntries(response.headers)).toEqual({
                    'cache-control': 'private, no-store',
                    'content-type': 'application/json',
                    location: '/movies/movie-id',
                    'retry-after': '2'
                })
            }
        )

        it('쿠키가 없으면 Authorization을 만들지 않고 401을 그대로 반환한다', async () => {
            upstream.mockResolvedValue(
                Response.json({ message: 'Login required' }, { status: 401 })
            )
            const response = await invoke(createProxy(), 'users/me')
            expect(response.status).toBe(401)
            await expect(response.json()).resolves.toEqual({ message: 'Login required' })
            expect(new Headers(upstream.mock.calls[0]?.[1]?.headers).has('authorization')).toBe(
                false
            )
            expect(response.headers.getSetCookie()).toEqual([])
            expect(upstream).toHaveBeenCalledOnce()
        })

        it('초기 API 호출의 연결 오류는 성공 응답으로 바꾸지 않는다', async () => {
            const error = new Error('Connection reset')
            upstream.mockRejectedValue(error)
            await expect(invoke(createProxy(), 'movies')).rejects.toBe(error)
        })
    })

    describe('origin과 인증 경로', () => {
        it.each(['GET', 'HEAD', 'OPTIONS'])(
            '%s는 다른 origin에서도 읽기 요청을 전달한다',
            async (method) => {
                upstream.mockResolvedValue(new Response(null, { status: 204 }))
                const response = await invoke(createProxy(), 'movies', {
                    method,
                    headers: { Origin: 'https://other.test' }
                })
                expect(response.status).toBe(204)
                expect(upstream.mock.calls[0]?.[1]?.body).toBeUndefined()
            }
        )

        it.each([
            ['다른 host', { Origin: 'https://other.test', Host: 'web.test' }],
            ['다른 protocol', { Origin: 'http://web.test', Host: 'web.test' }],
            ['잘못된 origin', { Origin: 'invalid', Host: 'web.test' }],
            ['host 누락', { Origin: 'https://web.test' }],
            ['빈 host', { Origin: 'https://web.test', Host: ' ' }]
        ])('%s인 쓰기 요청은 API 호출 전에 거부한다', async (_condition, headers) => {
            const response = await invoke(createProxy(), 'movies', { method: 'POST', headers })
            expect(response.status).toBe(403)
            await expect(response.json()).resolves.toEqual({ message: 'Invalid request origin' })
            expect(upstream).not.toHaveBeenCalled()
        })

        it.each(['admins', 'users'] as const)(
            '%s BFF는 다른 역할의 인증과 직접 refresh를 막는다',
            async (authPrefix) => {
                const proxy = createProxy({ authPrefix })
                const other = authPrefix === 'admins' ? 'users' : 'admins'
                for (const path of [
                    `${other}/login`,
                    `${other}/logout`,
                    `${other}/refresh`,
                    `${authPrefix}/refresh`
                ]) {
                    const response = await invoke(proxy, path, { method: 'POST' })
                    expect(response.status).toBe(404)
                    await expect(response.json()).resolves.toEqual({ message: 'Not found' })
                }
                expect(upstream).not.toHaveBeenCalled()
            }
        )

        it('동일 origin의 host 대소문자 차이는 허용한다', async () => {
            upstream.mockResolvedValue(new Response(null, { status: 204 }))
            const response = await invoke(createProxy(), 'movies', {
                method: 'POST',
                headers: { Origin: 'https://WEB.test', Host: 'web.TEST' }
            })
            expect(response.status).toBe(204)
        })
    })

    describe('클라이언트 IP 전달', () => {
        it.each([
            [false, { 'X-Forwarded-For': '203.0.113.2' }, null],
            [true, { 'X-Forwarded-For': '198.51.100.1, 203.0.113.2' }, '203.0.113.2'],
            [true, { 'X-Forwarded-For': '198.51.100.1, ::1' }, '::1'],
            [
                true,
                { 'X-Forwarded-For': '198.51.100.1, invalid', 'X-Real-IP': '203.0.113.3' },
                null
            ],
            [true, { 'X-Forwarded-For': '' }, null],
            [true, { 'X-Real-IP': '203.0.113.3' }, '203.0.113.3'],
            [true, { 'X-Real-IP': 'invalid' }, null],
            [true, { 'X-Real-IP': '' }, null],
            [true, {}, null]
        ] as const)(
            '신뢰=%s, 헤더=%j이면 연결 IP %s를 전달한다',
            async (trustProxyHeaders, headers, expected) => {
                upstream.mockResolvedValue(new Response(null, { status: 204 }))
                await invoke(createProxy({ trustProxyHeaders }), 'movies', { headers })
                expect(
                    new Headers(upstream.mock.calls[0]?.[1]?.headers).get('x-forwarded-for')
                ).toBe(expected)
            }
        )
    })

    describe('본문 크기와 스트림', () => {
        it('Content-Length가 1 MiB를 넘으면 API를 호출하지 않는다', async () => {
            const response = await invoke(createProxy(), 'movies', {
                method: 'POST',
                headers: { 'Content-Length': String(1024 * 1024 + 1) }
            })
            expect(response.status).toBe(413)
            await expect(response.json()).resolves.toMatchObject({
                code: 'ERR_BFF_PAYLOAD_TOO_LARGE'
            })
            expect(upstream).not.toHaveBeenCalled()
        })

        it('길이 헤더가 없어도 읽은 본문이 한도를 넘으면 읽기를 취소한다', async () => {
            const cancel = vi.fn(async () => {
                throw new Error('Socket already closed')
            })
            const body = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(new Uint8Array(1024 * 1024))
                    controller.enqueue(new Uint8Array(1))
                },
                cancel
            })
            const response = await invoke(createProxy(), 'movies', { method: 'POST', body })
            expect(response.status).toBe(413)
            expect(cancel).toHaveBeenCalledOnce()
            expect(upstream).not.toHaveBeenCalled()
        })

        it('길이 헤더가 잘못되어도 실제 1 MiB 본문은 그대로 전달한다', async () => {
            upstream.mockResolvedValue(new Response(null, { status: 204 }))
            const body = new Uint8Array(1024 * 1024).fill(7)
            const response = await invoke(createProxy(), 'movies', {
                method: 'POST',
                body,
                headers: { 'Content-Length': 'unknown' }
            })
            expect(response.status).toBe(204)
            expect(Buffer.from(upstream.mock.calls[0]?.[1]?.body as ArrayBuffer).equals(body)).toBe(
                true
            )
        })

        it('내용 없이 종료한 스트림은 본문을 추가하지 않는다', async () => {
            upstream.mockResolvedValue(new Response(null, { status: 204 }))
            const body = new ReadableStream<Uint8Array>({
                start: (controller) => controller.close()
            })
            await invoke(createProxy(), 'movies', { method: 'POST', body })
            expect(upstream.mock.calls[0]?.[1]?.body).toBeUndefined()
        })

        it('본문 읽기 오류는 크기 초과 오류로 바꾸지 않는다', async () => {
            const error = new Error('Upload interrupted')
            const body = new ReadableStream<Uint8Array>({
                start: (controller) => controller.error(error)
            })
            await expect(invoke(createProxy(), 'movies', { method: 'POST', body })).rejects.toBe(
                error
            )
            expect(upstream).not.toHaveBeenCalled()
        })
    })

    describe('로그인과 로그아웃', () => {
        it.each([
            ['users', false],
            ['admins', true]
        ] as const)(
            '%s 로그인은 JWT 만료에 맞는 HttpOnly 쿠키만 반환한다',
            async (authPrefix, secureCookies) => {
                upstream.mockResolvedValue(Response.json(tokens))
                const response = await invoke(
                    createProxy({ authPrefix, secureCookies }),
                    `${authPrefix}/login`,
                    { method: 'POST', body: '{"email":"user@test"}' }
                )
                expect(response.status).toBe(204)
                expect(await response.text()).toBe('')
                expect(response.headers.get('cache-control')).toBe('private, no-store')
                expectSessionCookies(response, secureCookies)
            }
        )

        it('로그인 실패는 기존 세션으로 갱신하지 않고 그대로 반환한다', async () => {
            upstream.mockResolvedValue(
                Response.json({ message: 'Invalid credentials' }, { status: 401 })
            )
            const response = await invoke(createProxy(), 'users/login', {
                method: 'POST',
                cookies: SESSION
            })
            expect(response.status).toBe(401)
            await expect(response.json()).resolves.toEqual({ message: 'Invalid credentials' })
            expect(response.headers.getSetCookie()).toEqual([])
            expect(upstream).toHaveBeenCalledOnce()
        })

        it.each([
            'invalid-json',
            'null',
            '{}',
            '{"accessToken":1}',
            JSON.stringify({ accessToken: tokens.accessToken, refreshToken: null }),
            JSON.stringify({ accessToken: 'invalid-token', refreshToken: tokens.refreshToken }),
            ...['{}', '{"exp":"soon"}', '{"exp":1e999}'].map((payload) =>
                JSON.stringify({
                    accessToken: tokens.accessToken,
                    refreshToken: `header.${Buffer.from(payload).toString('base64url')}.signature`
                })
            )
        ])('잘못된 로그인 응답 %s는 쿠키를 만들지 않는다', async (body) => {
            upstream.mockResolvedValue(new Response(body))
            const response = await invoke(createProxy(), 'users/login', { method: 'POST' })
            expect(response.status).toBe(502)
            await expect(response.json()).resolves.toEqual({
                message: 'Invalid authentication response'
            })
            expect(response.headers.getSetCookie()).toEqual([])
        })

        it('로그아웃은 클라이언트 본문 대신 쿠키의 refresh token을 폐기한다', async () => {
            upstream.mockResolvedValue(new Response(null, { status: 204 }))
            const response = await invoke(createProxy(), 'users/logout', {
                method: 'POST',
                cookies: SESSION,
                headers: { 'Content-Type': 'application/json' },
                body: '{"refreshToken":"other-session"}'
            })
            expect(
                JSON.parse(
                    new TextDecoder().decode(upstream.mock.calls[0]?.[1]?.body as ArrayBuffer)
                )
            ).toEqual({ refreshToken: 'old-refresh' })
            expect(response.status).toBe(204)
            expectClearedCookies(response)
        })

        it('refresh 쿠키가 없는 로그아웃도 브라우저 쿠키를 지운다', async () => {
            const response = await invoke(createProxy(), 'users/logout', {
                method: 'POST',
                cookies: { [ACCESS_COOKIE]: 'access-only' }
            })
            expect(response.status).toBe(204)
            expectClearedCookies(response)
            expect(upstream).not.toHaveBeenCalled()
        })

        it('로그아웃 API 연결이 실패해도 브라우저 쿠키를 지우고 실패를 알린다', async () => {
            upstream.mockRejectedValue(new Error('Offline'))
            const response = await invoke(createProxy(), 'users/logout', {
                method: 'POST',
                cookies: SESSION
            })
            expect(response.status).toBe(502)
            await expect(response.json()).resolves.toEqual({
                message: 'Logout service unavailable'
            })
            expectClearedCookies(response)
        })
    })

    describe('리프레시와 원 요청 재시도', () => {
        it.each(['https://api.test/v1', 'https://api.test/v1/'])(
            'API 기준 주소 %s의 경로를 갱신과 재시도에도 유지한다',
            async (apiBaseUrl) => {
                upstream
                    .mockResolvedValueOnce(new Response(null, { status: 401 }))
                    .mockResolvedValueOnce(Response.json(tokens))
                    .mockResolvedValueOnce(Response.json({ id: 'movie-id' }))
                const response = await invoke(
                    createProxy({ apiBaseUrl: () => apiBaseUrl }),
                    'movies',
                    { cookies: SESSION }
                )
                expect(response.status).toBe(200)
                expect(upstream.mock.calls.map(([url]) => String(url))).toEqual([
                    'https://api.test/v1/movies',
                    'https://api.test/v1/users/refresh',
                    'https://api.test/v1/movies'
                ])
            }
        )

        it('새 액세스 토큰으로 원 본문을 한 번 재전송하고 새 쿠키를 저장한다', async () => {
            upstream
                .mockResolvedValueOnce(new Response(null, { status: 401 }))
                .mockResolvedValueOnce(Response.json(tokens))
                .mockResolvedValueOnce(Response.json({ id: 'purchase-id' }, { status: 201 }))
            const response = await invoke(createProxy(), 'purchases', {
                method: 'POST',
                body: '{"tickets":["ticket-id"]}',
                cookies: SESSION,
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'same-request' }
            })
            const [refreshUrl, refreshInit] = upstream.mock.calls[1]!
            expect(String(refreshUrl)).toBe('https://api.test/users/refresh')
            expect(refreshInit).toMatchObject({
                method: 'POST',
                body: '{"refreshToken":"old-refresh"}',
                cache: 'no-store'
            })
            const retried = upstream.mock.calls[2]?.[1]
            expect(retried?.body).toEqual(upstream.mock.calls[0]?.[1]?.body)
            expect(new Headers(retried?.headers).get('authorization')).toBe(
                `Bearer ${tokens.accessToken}`
            )
            expect(new Headers(retried?.headers).get('idempotency-key')).toBe('same-request')
            expect(response.status).toBe(201)
            await expect(response.json()).resolves.toEqual({ id: 'purchase-id' })
            expectSessionCookies(response)
            expect(upstream).toHaveBeenCalledTimes(3)
        })

        it('갱신 후 재시도한 요청이 401이어도 추가 갱신 없이 새 쿠키를 보관한다', async () => {
            upstream
                .mockResolvedValueOnce(new Response(null, { status: 401 }))
                .mockResolvedValueOnce(Response.json(tokens))
                .mockResolvedValueOnce(
                    Response.json({ message: 'Still unauthorized' }, { status: 401 })
                )
            const response = await invoke(createProxy(), 'users/me', { cookies: SESSION })
            expect(response.status).toBe(401)
            expectSessionCookies(response)
            expect(upstream).toHaveBeenCalledTimes(3)
        })

        it('토큰 회전 뒤 원 요청 재시도가 실패해도 새 쿠키를 잃지 않는다', async () => {
            upstream
                .mockResolvedValueOnce(new Response(null, { status: 401 }))
                .mockResolvedValueOnce(Response.json(tokens))
                .mockRejectedValueOnce(new Error('Connection reset'))
            const response = await invoke(createProxy(), 'users/me', { cookies: SESSION })
            expect(response.status).toBe(502)
            await expect(response.json()).resolves.toEqual({
                message: 'Upstream service unavailable'
            })
            expectSessionCookies(response)
        })

        it('다른 BFF에서 토큰을 교체했으면 승자의 쿠키를 지우지 않는다', async () => {
            upstream
                .mockResolvedValueOnce(new Response(null, { status: 401 }))
                .mockResolvedValueOnce(new Response(null, { status: 409 }))
            const response = await invoke(createProxy(), 'users/me', { cookies: SESSION })
            expect(response.status).toBe(409)
            await expect(response.json()).resolves.toMatchObject({
                code: 'ERR_JWT_AUTH_REFRESH_TOKEN_REPLACED'
            })
            expect(response.headers.getSetCookie()).toEqual([])
        })

        it('refresh token이 거부되면 최초 401을 반환하고 쿠키를 지운다', async () => {
            upstream
                .mockResolvedValueOnce(
                    Response.json({ message: 'Access expired' }, { status: 401 })
                )
                .mockResolvedValueOnce(new Response(null, { status: 401 }))
            const response = await invoke(createProxy(), 'users/me', { cookies: SESSION })
            expect(response.status).toBe(401)
            await expect(response.json()).resolves.toEqual({ message: 'Access expired' })
            expectClearedCookies(response)
        })

        it.each(['server-error', 'connection-error', 'invalid-tokens'] as const)(
            '갱신 실패 %s는 로그아웃시키지 않고 502로 알린다',
            async (failure) => {
                upstream.mockResolvedValueOnce(new Response(null, { status: 401 }))
                if (failure === 'connection-error')
                    upstream.mockRejectedValueOnce(new Error('Offline'))
                else
                    upstream.mockResolvedValueOnce(
                        failure === 'server-error'
                            ? new Response(null, { status: 503 })
                            : Response.json({ accessToken: 'invalid' })
                    )
                const response = await invoke(createProxy(), 'users/me', { cookies: SESSION })
                expect(response.status).toBe(502)
                await expect(response.json()).resolves.toEqual({
                    message: 'Authentication service unavailable'
                })
                expect(response.headers.getSetCookie()).toEqual([])
            }
        )

        it('동시 401은 한 번 갱신하고 늦게 도착한 401도 1초 안에서는 같은 결과를 쓴다', async () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
            try {
                const refresh = Promise.withResolvers<Response>()
                const started = Promise.withResolvers<void>()
                let refreshCount = 0
                upstream.mockImplementation(async (input, init) => {
                    if (new URL(String(input)).pathname === '/users/refresh') {
                        refreshCount += 1
                        started.resolve()
                        return refreshCount === 1
                            ? refresh.promise
                            : new Response(null, { status: 409 })
                    }
                    return new Headers(init?.headers).get('authorization') ===
                        `Bearer ${tokens.accessToken}`
                        ? Response.json({ email: 'user@test' })
                        : new Response(null, { status: 401 })
                })
                const proxy = createProxy()
                const pending = Array.from({ length: 8 }, () =>
                    invoke(proxy, 'users/me', { cookies: SESSION })
                )
                await started.promise
                refresh.resolve(Response.json(tokens))
                for (const response of await Promise.all(pending)) {
                    expect(response.status).toBe(200)
                    await expect(response.json()).resolves.toEqual({ email: 'user@test' })
                    expectSessionCookies(response)
                }
                expect(refreshCount).toBe(1)

                await vi.advanceTimersByTimeAsync(999)
                const delayed = await invoke(proxy, 'users/me', { cookies: SESSION })
                expect(delayed.status).toBe(200)
                expectSessionCookies(delayed)
                expect(refreshCount).toBe(1)

                await vi.advanceTimersByTimeAsync(1)
                const afterExpiry = await invoke(proxy, 'users/me', { cookies: SESSION })
                expect(afterExpiry.status).toBe(409)
                expect(afterExpiry.headers.getSetCookie()).toEqual([])
                expect(refreshCount).toBe(2)
                await vi.runAllTimersAsync()
            } finally {
                vi.useRealTimers()
            }
        })
    })
})
