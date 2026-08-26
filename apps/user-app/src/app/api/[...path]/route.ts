import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { resolveForwardedClientIp, retryWithRotatedSession, type AuthTokens } from '@/lib/bff-proxy'

const API_BASE_URL = getApiBaseUrl()

const ACCESS_COOKIE = 'nest-seed-user-access'
const REFRESH_COOKIE = 'nest-seed-user-refresh'
const AUTH_PREFIX = 'users'
const MAX_REQUEST_BODY_BYTES = 1024 * 1024
const REFRESH_RESULT_GRACE_MS = 1000
const REFRESH_CONCURRENT_ERROR = {
    code: 'ERR_JWT_AUTH_REFRESH_TOKEN_CONCURRENT',
    message: 'A refresh is already in progress'
}
const AUTH_OPERATIONS = new Set(['login', 'logout', 'refresh'])
const TRUST_PROXY_HEADERS = process.env.BFF_TRUST_PROXY_HEADERS === 'true'
const PRIVATE_RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store' }
const COOKIE_OPTIONS = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production'
}

type RouteContext = { params: Promise<{ path: string[] }> }
type RefreshResult = { status: number; tokens: AuthTokens | null }

const refreshFlights = new Map<string, Promise<RefreshResult>>()

class PayloadTooLargeError extends Error {}

function getApiBaseUrl(): string {
    const value = process.env.API_BASE_URL
    if (!value) throw new Error('API_BASE_URL is required')
    return value
}

async function proxy(request: NextRequest, context: RouteContext): Promise<NextResponse> {
    if (!hasTrustedOrigin(request)) {
        return jsonResponse({ message: 'Invalid request origin' }, 403)
    }

    const { path } = await context.params
    if (isBlockedAuthEndpoint(path)) {
        return jsonResponse({ message: 'Not found' }, 404)
    }

    const pathname = path.map(encodeURIComponent).join('/')
    const authPath = `${AUTH_PREFIX}/`
    const isLogin = pathname === `${authPath}login`
    const isLogout = pathname === `${authPath}logout`
    const isRefresh = pathname === `${authPath}refresh`
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value
    let body: ArrayBuffer | undefined
    try {
        body = await readBody(request)
    } catch (error) {
        if (error instanceof PayloadTooLargeError) {
            return jsonResponse(
                { code: 'ERR_BFF_PAYLOAD_TOO_LARGE', message: 'Request body too large' },
                413
            )
        }
        throw error
    }

    if (isLogout) {
        let upstream: Response
        try {
            upstream = refreshToken
                ? await callApi(request, pathname, accessToken, jsonBody({ refreshToken }))
                : new Response(null, { status: 204 })
        } catch {
            upstream = Response.json({ message: 'Logout service unavailable' }, { status: 502 })
        }
        const response = await copyResponse(upstream)
        clearAuthCookies(response)
        return response
    }

    const upstream = await callApi(request, pathname, accessToken, body)

    if (isLogin && upstream.ok) {
        const tokens = await parseTokens(upstream)
        if (!tokens) {
            return jsonResponse({ message: 'Invalid authentication response' }, 502)
        }
        const response = new NextResponse(null, { status: 204, headers: PRIVATE_RESPONSE_HEADERS })
        setAuthCookies(response, tokens)
        return response
    }

    if (upstream.status === 401 && refreshToken && !isLogin && !isRefresh) {
        const refreshed = await refreshAuthTokens(authPath, refreshToken)
        if (refreshed.tokens) {
            const tokens = refreshed.tokens
            return retryWithRotatedSession({
                createUnavailableResponse: () =>
                    jsonResponse({ message: 'Upstream service unavailable' }, 502),
                retry: async () => {
                    const retried = await callApi(request, pathname, tokens.accessToken, body)
                    return copyResponse(retried)
                },
                setAuthTokens: setAuthCookies,
                tokens
            })
        }

        // 다른 BFF 인스턴스가 같은 토큰을 막 회전한 경우에는 winner가 내려 준 쿠키를
        // 뒤늦은 loser 응답이 지우지 않도록 409만 전달한다.
        if (refreshed.status === 409) {
            return jsonResponse(REFRESH_CONCURRENT_ERROR, 409)
        }
        if (refreshed.status >= 500) {
            return jsonResponse({ message: 'Authentication service unavailable' }, 502)
        }

        const response = await copyResponse(upstream)
        clearAuthCookies(response)
        return response
    }

    return copyResponse(upstream)
}

function isBlockedAuthEndpoint(path: string[]): boolean {
    if (path.length !== 2) return false

    const [namespace, operation] = path
    const isAuthEndpoint =
        (namespace === 'admins' || namespace === 'users') &&
        operation !== undefined &&
        AUTH_OPERATIONS.has(operation)

    // login/logout은 이 BFF가 담당하는 역할만 허용하고, refresh는 내부 회전에서만 호출한다.
    return isAuthEndpoint && (namespace !== AUTH_PREFIX || operation === 'refresh')
}

function hasTrustedOrigin(request: NextRequest): boolean {
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
        return true
    }
    const origin = request.headers.get('origin')
    return origin === null || origin === request.nextUrl.origin
}

async function readBody(request: NextRequest): Promise<ArrayBuffer | undefined> {
    if (request.method === 'GET' || request.method === 'HEAD') return undefined

    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
        throw new PayloadTooLargeError()
    }

    const reader = request.body?.getReader()
    if (!reader) return undefined

    const chunks: Uint8Array[] = []
    let length = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        length += value.byteLength
        if (length > MAX_REQUEST_BODY_BYTES) {
            await reader.cancel().catch(() => undefined)
            throw new PayloadTooLargeError()
        }
        chunks.push(value)
    }

    if (length === 0) return undefined

    const body = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
    }
    return body.buffer
}

function jsonBody(value: unknown): ArrayBuffer {
    return new TextEncoder().encode(JSON.stringify(value)).buffer
}

async function callApi(
    request: NextRequest,
    pathname: string,
    accessToken: string | undefined,
    body: ArrayBuffer | undefined
): Promise<Response> {
    const url = new URL(pathname, API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`)
    url.search = request.nextUrl.search
    const headers = new Headers()
    const accept = request.headers.get('accept')
    const contentType = request.headers.get('content-type')
    const idempotencyKey = request.headers.get('idempotency-key')
    const clientIp = resolveForwardedClientIp(request.headers, TRUST_PROXY_HEADERS)
    if (accept) headers.set('Accept', accept)
    if (contentType) headers.set('Content-Type', contentType)
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
    // 명시적으로 신뢰한 ingress가 연결 IP를 체인 오른쪽에 append하는 배포에서만 전달한다.
    if (clientIp) headers.set('X-Forwarded-For', clientIp)
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

    return fetch(url, {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
        redirect: 'manual'
    })
}

async function refreshAuthTokens(authPath: string, refreshToken: string): Promise<RefreshResult> {
    const key = createHash('sha256').update(refreshToken).digest('base64url')
    const existing = refreshFlights.get(key)
    if (existing) return existing

    const flight = performRefresh(authPath, refreshToken)
    refreshFlights.set(key, flight)
    void flight.finally(() => {
        // 최초 보호 요청들의 401 도착 순서가 조금 어긋나도 같은 회전 결과를 공유한다.
        setTimeout(() => {
            if (refreshFlights.get(key) === flight) refreshFlights.delete(key)
        }, REFRESH_RESULT_GRACE_MS)
    })
    return flight
}

async function performRefresh(authPath: string, refreshToken: string): Promise<RefreshResult> {
    try {
        const response = await fetch(new URL(`${authPath}refresh`, API_BASE_URL), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
            cache: 'no-store'
        })
        if (!response.ok) return { status: response.status, tokens: null }

        const tokens = await parseTokens(response)
        return tokens ? { status: response.status, tokens } : { status: 502, tokens: null }
    } catch {
        return { status: 502, tokens: null }
    }
}

async function parseTokens(response: Response): Promise<AuthTokens | null> {
    const value = (await response
        .clone()
        .json()
        .catch(() => null)) as Partial<AuthTokens> | null
    if (!value || typeof value.accessToken !== 'string' || typeof value.refreshToken !== 'string') {
        return null
    }
    return { accessToken: value.accessToken, refreshToken: value.refreshToken }
}

async function copyResponse(upstream: Response): Promise<NextResponse> {
    const body = upstream.status === 204 ? null : upstream.body
    const response = new NextResponse(body, { status: upstream.status })
    for (const header of ['content-type', 'location', 'retry-after']) {
        const value = upstream.headers.get(header)
        if (value) response.headers.set(header, value)
    }
    response.headers.set('Cache-Control', PRIVATE_RESPONSE_HEADERS['Cache-Control'])
    return response
}

function jsonResponse(body: unknown, status: number): NextResponse {
    return NextResponse.json(body, { headers: PRIVATE_RESPONSE_HEADERS, status })
}

function setAuthCookies(response: NextResponse, tokens: AuthTokens): void {
    response.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...COOKIE_OPTIONS, maxAge: 30 * 60 })
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60
    })
}

function clearAuthCookies(response: NextResponse): void {
    response.cookies.set(ACCESS_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
    response.cookies.set(REFRESH_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const PUT = proxy
export const DELETE = proxy
