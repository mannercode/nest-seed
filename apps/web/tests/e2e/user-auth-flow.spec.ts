import { expect, request, test, type BrowserContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mock } from 'node:test'
import { NextRequest } from 'next/server.js'

import {
    API_BASE_URL,
    S3_BUCKET,
    S3_ENDPOINT,
    WEB_BASE_URL,
    WORKSPACE_ROOT
} from '../playwright.config'
import { photoUrl } from '@/lib/photos'
import { GET } from '@/app/api/[...path]/route'

const PASSWORD = 'DevPassword1234!'
const ACCESS_COOKIE = 'nest-seed-user-access'
const REFRESH_COOKIE = 'nest-seed-user-refresh'

async function signupAndLogin(page: Page, password = PASSWORD): Promise<string> {
    const email = `e2e-user-${randomUUID()}@example.com`

    await page.goto(`${WEB_BASE_URL}/signup`)
    await page.getByRole('textbox', { name: '이름' }).fill('E2E User')
    await page.getByRole('textbox', { name: '이메일' }).fill(email)
    await page.getByLabel('비밀번호').fill(password)
    await page.getByRole('button', { name: '회원가입' }).click()
    await expect(page).toHaveURL(`${WEB_BASE_URL}/login`)

    await page.getByRole('textbox', { name: '이메일' }).fill(email)
    await page.getByLabel('비밀번호').fill(password)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(`${WEB_BASE_URL}/`)

    return email
}

async function getSessionCookie(context: BrowserContext, name: string) {
    const cookies = await context.cookies(WEB_BASE_URL)
    return cookies.find((cookie) => cookie.name === name)
}

const storage = new URL(S3_ENDPOINT)
const otherBucket = S3_BUCKET + '-other'
for (const [condition, target] of [
    ['다른 저장소', 'https://other-storage.example/photo.png'],
    ['경로에 있는 다른 버킷', `${storage.href.replace(/\/$/, '')}/${otherBucket}/photo.png`],
    ['호스트명에 있는 다른 버킷', `${storage.protocol}//${otherBucket}.${storage.host}/photo.png`]
] as const) {
    test.describe(`사진 주소의 대상이 ${condition}이면`, () => {
        test('사진 프록시가 400을 반환한다', async ({ page }) => {
            const response = await page.goto(photoUrl(target))
            expect(response?.status()).toBe(400)
        })
    })
}

for (const { condition, password } of [
    { condition: '이모지 15자', password: '🌱'.repeat(15) },
    { condition: '이모지 128자', password: '🌱'.repeat(128) },
    { condition: '앞뒤 공백을 포함한 20자', password: '  browser password  ' }
]) {
    test.describe(`가입할 비밀번호가 ${condition}이면`, () => {
        test('가입과 로그인 화면에서 원문을 그대로 사용할 수 있다', async ({ page }) => {
            const [signup, login, email] = await Promise.all([
                page.waitForRequest(
                    (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/users'
                ),
                page.waitForRequest(
                    (req) =>
                        req.method() === 'POST' &&
                        new URL(req.url()).pathname === '/api/users/login'
                ),
                signupAndLogin(page, password)
            ])
            expect(signup.postDataJSON().password).toBe(password)
            expect(login.postDataJSON().password).toBe(password)
            const result = await page.evaluate(async () => {
                const response = await fetch('/api/users/me')
                return { status: response.status, body: await response.json() }
            })
            expect(result.status).toBe(200)
            expect(result.body.email).toBe(email)
        })
    })
}

for (const { name, pathname } of [
    { name: '가입', pathname: '/signup' },
    { name: '로그인', pathname: '/login' }
]) {
    for (const { condition, password } of [
        { condition: '이모지 14자', password: '🌱'.repeat(14) },
        { condition: '이모지 129자', password: '🌱'.repeat(129) }
    ]) {
        test.describe(`${name} 화면에 입력한 비밀번호가 ${condition}이면`, () => {
            test.beforeEach(async ({ page }) => {
                await page.goto(`${WEB_BASE_URL}${pathname}`)
                await page.getByLabel('비밀번호').fill(password)
            })
            test('비밀번호 원문을 유지하고 브라우저의 길이 검사를 통과하지 못한다', async ({
                page
            }) => {
                const input = page.getByLabel('비밀번호')
                await expect(input).toHaveValue(password)
                expect(
                    await input.evaluate((element) => (element as HTMLInputElement).checkValidity())
                ).toBe(false)
                expect(
                    await input.evaluate(
                        (element) => (element as HTMLInputElement).validity.patternMismatch
                    )
                ).toBe(true)
            })
        })
    }
}

test.describe('로그인 전', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${WEB_BASE_URL}/login`)
    })
    for (const { condition, status, body } of [
        { condition: '빈 HTTP 200', status: 200, body: '' },
        { condition: 'HTML 본문이 있는 HTTP 503', status: 503, body: '<h1>Unavailable</h1>' }
    ]) {
        test.describe(`로그인 API가 ${condition}을 반환하면`, () => {
            test.beforeEach(async ({ page }) => {
                await page.route('**/api/users/login', (route) =>
                    route.fulfill({ status, contentType: 'text/html', body })
                )
                await page.getByLabel('이메일').fill('login@example.com')
                await page.getByLabel('비밀번호').fill(PASSWORD)
            })
            test('로그인 화면에 해당 HTTP 상태를 표시한다', async ({ page }) => {
                await page.getByRole('button', { name: '로그인' }).click()
                await expect(page.getByRole('main').getByRole('alert')).toContainText(
                    String(status)
                )
                await expect(page).toHaveURL(`${WEB_BASE_URL}/login`)
            })
        })
    }
    test('사용자 앱에서 토큰 갱신 경로를 직접 요청하면 404를 반환한다', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const response = await fetch('/api/users/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: 'client-controlled-refresh-token' })
            })
            const body = await response.text()
            return {
                exposesToken: /"(?:accessToken|refreshToken)"\s*:/.test(body),
                status: response.status
            }
        })

        expect(result).toEqual({ exposesToken: false, status: 404 })
    })
})

test.describe('보호 API가 401을 반환하고 토큰 갱신이 503을 반환하면', () => {
    test.afterEach(() => mock.restoreAll())
    test('502를 반환하고 두 API 응답 본문을 닫는다', async () => {
        const closed: number[] = []
        mock.method(globalThis, 'fetch', async (url: URL) => {
            const status = url.pathname === '/users/refresh' ? 503 : 401
            const body = new ReadableStream({
                cancel: () => {
                    closed.push(status)
                }
            })
            return new Response(body, { status })
        })

        const request = new NextRequest(new URL('/api/users/me', WEB_BASE_URL), {
            headers: { cookie: REFRESH_COOKIE + '=expired' }
        })
        const response = await GET(request, { params: Promise.resolve({ path: ['users', 'me'] }) })
        expect(response.status).toBe(502)
        expect(closed.sort()).toEqual([401, 503])
    })
})

test.describe('로그인 후', () => {
    let email: string
    let accessCookie: Awaited<ReturnType<typeof getSessionCookie>>
    let refreshCookieBefore: Awaited<ReturnType<typeof getSessionCookie>>
    let loginHeaders: Array<{ name: string; value: string }>
    test.beforeEach(async ({ context, page }) => {
        const response = page.waitForResponse(
            (response) => new URL(response.url()).pathname === '/api/users/login'
        )
        email = await signupAndLogin(page)
        accessCookie = await getSessionCookie(context, ACCESS_COOKIE)
        refreshCookieBefore = await getSessionCookie(context, REFRESH_COOKIE)
        loginHeaders = await (await response).headersArray()
    })
    test('로그인 응답은 쿠키에 HttpOnly·SameSite=Lax와 토큰의 만료 시각을 지정한다', async () => {
        expect(accessCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
        expect(refreshCookieBefore).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
        // Chromium은 Date 헤더로 시계 차이를 보정하므로 서버가 보낸 Expires 자체를 검증한다.
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#expiresdate
        for (const cookie of [accessCookie!, refreshCookieBefore!]) {
            const payload = JSON.parse(
                Buffer.from(cookie.value.split('.')[1]!, 'base64url').toString('utf8')
            ) as { exp: number }
            const header = loginHeaders.find(
                ({ name, value }) =>
                    name.toLowerCase() === 'set-cookie' && value.startsWith(cookie.name + '=')
            )
            expect(header?.value).toContain(`Expires=${new Date(payload.exp * 1000).toUTCString()}`)
        }
    })
    test('보호 API와 홈을 요청하면 본인 정보만 반환한다', async ({ page }) => {
        const me = await page.evaluate(async () => {
            const response = await fetch('/api/users/me')
            return { body: (await response.json()) as { email: string }, status: response.status }
        })
        expect(me).toEqual({ body: expect.objectContaining({ email }), status: 200 })

        const home = await page.evaluate(async () => {
            const response = await fetch('/api/views/web/home')
            return {
                body: (await response.json()) as {
                    user: { email: string }
                    photoUrl: string | null
                },
                status: response.status
            }
        })
        expect(home).toEqual({
            body: { user: expect.objectContaining({ email, photoAssetId: null }), photoUrl: null },
            status: 200
        })
        await expect(page.getByText(email)).toBeVisible()
    })
    test('로그인 경로의 대소문자가 달라도 토큰은 본문 없이 쿠키로 전달한다', async ({
        context,
        page
    }) => {
        const result = await page.evaluate(
            async ({ email, password }) => {
                const response = await fetch('/api/Users/Login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                })
                const body = await response.text()
                return {
                    exposesToken: /"(?:accessToken|refreshToken)"\s*:/.test(body),
                    hasBody: body.length > 0,
                    status: response.status
                }
            },
            { email, password: PASSWORD }
        )

        expect(result).toEqual({ exposesToken: false, hasBody: false, status: 204 })
        const refreshCookie = await getSessionCookie(context, REFRESH_COOKIE)
        expect(refreshCookie).toMatchObject({ httpOnly: true, value: expect.any(String) })
        expect(refreshCookie?.value === refreshCookieBefore?.value).toBe(false)
    })
    test('대소문자를 바꾼 갱신 경로도 404를 반환하고 기존 세션을 유지한다', async ({
        page,
        request: api
    }) => {
        expect(refreshCookieBefore).toBeDefined()
        const result = await page.evaluate(async (refreshToken) => {
            const response = await fetch('/api/Users/Refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            })
            const body = await response.text()
            return {
                exposesToken: /"(?:accessToken|refreshToken)"\s*:/.test(body),
                status: response.status
            }
        }, refreshCookieBefore!.value)
        const refresh = await api.post(`${API_BASE_URL}/users/refresh`, {
            data: { refreshToken: refreshCookieBefore!.value }
        })

        expect({ ...result, originalTokenStatus: refresh.status() }).toEqual({
            exposesToken: false,
            originalTokenStatus: 200,
            status: 404
        })
    })
    for (const method of ['GET', 'HEAD']) {
        test(`${method} 로그아웃 요청은 404를 반환하고 쿠키와 서버 세션을 유지한다`, async ({
            context,
            page,
            request: api
        }) => {
            expect(accessCookie).toBeDefined()
            expect(refreshCookieBefore).toBeDefined()
            const status = await page.evaluate(
                async (method) => (await fetch('/api/users/logout', { method })).status,
                method
            )
            const accessAfter = await getSessionCookie(context, ACCESS_COOKIE)
            const refreshAfter = await getSessionCookie(context, REFRESH_COOKIE)
            const refresh = await api.post(`${API_BASE_URL}/users/refresh`, {
                data: { refreshToken: refreshCookieBefore!.value }
            })

            expect({
                accessCookieRetained: accessAfter?.value === accessCookie!.value,
                refreshCookieRetained: refreshAfter?.value === refreshCookieBefore!.value,
                refreshStatus: refresh.status(),
                status
            }).toEqual({
                accessCookieRetained: true,
                refreshCookieRetained: true,
                refreshStatus: 200,
                status: 404
            })
        })
    }
    test('로그아웃하면 브라우저 쿠키와 서버의 리프레시 토큰을 폐기한다', async ({
        context,
        page
    }) => {
        expect(refreshCookieBefore).toMatchObject({ httpOnly: true, sameSite: 'Lax' })

        await page.getByRole('button', { name: '로그아웃' }).click()

        await expect.poll(async () => getSessionCookie(context, ACCESS_COOKIE)).toBeUndefined()
        expect(await getSessionCookie(context, REFRESH_COOKIE)).toBeUndefined()
        expect(await page.evaluate(async () => (await fetch('/api/users/me')).status)).toBe(401)

        const api = await request.newContext()
        try {
            const response = await api.post(`${API_BASE_URL}/users/refresh`, {
                data: { refreshToken: refreshCookieBefore!.value }
            })
            expect(response.status()).toBe(401)
        } finally {
            await api.dispose()
        }
    })
    test.describe('액세스 쿠키의 토큰이 유효하지 않은 상태에서', () => {
        test.beforeEach(async ({ context }) => {
            await context.addCookies([{ ...accessCookie!, value: 'invalid-access-token' }])
        })
        test.describe('보호 API가 401을 반환하고 웹 핸들러가 갱신 서비스에 연결할 수 없으면', () => {
            test.beforeEach(() => {
                const fetchApi = globalThis.fetch
                mock.method(globalThis, 'fetch', (url: URL, init: RequestInit) => {
                    if (url.href === new URL('/users/refresh', API_BASE_URL).href)
                        throw new TypeError('Refresh service unavailable')
                    return fetchApi(url, init)
                })
            })
            test.afterEach(() => mock.restoreAll())
            test('502를 반환하고 서비스 복구 후 같은 쿠키로 다시 요청할 수 있다', async ({
                context
            }) => {
                const cookies = await context.cookies(WEB_BASE_URL)
                const cookie = cookies.map(({ name, value }) => name + '=' + value).join('; ')
                const sendRequest = () =>
                    GET(
                        new NextRequest(new URL('/api/users/me', WEB_BASE_URL), {
                            headers: { cookie }
                        }),
                        { params: Promise.resolve({ path: ['users', 'me'] }) }
                    )
                const failed = await sendRequest()
                expect(failed.status).toBe(502)
                expect(await failed.json()).toEqual({
                    message: 'Authentication service unavailable'
                })
                expect(failed.headers.has('set-cookie')).toBe(false)

                mock.restoreAll()
                const recovered = await sendRequest()
                expect(recovered.status).toBe(200)
                expect(await recovered.json()).toMatchObject({ email })
                expect(recovered.cookies.get(REFRESH_COOKIE)?.value).toEqual(expect.any(String))
                expect(recovered.cookies.get(REFRESH_COOKIE)?.value).not.toBe(
                    refreshCookieBefore!.value
                )
            })
        })
        test.describe('같은 갱신 쿠키를 가진 두 브라우저가', () => {
            let otherPage: Page
            test.beforeEach(async ({ browser, context }) => {
                otherPage = await browser.newPage({
                    baseURL: WEB_BASE_URL,
                    storageState: await context.storageState()
                })
            })
            test.afterEach(async () => {
                await otherPage.close()
            })
            test('첫 응답 직후 이전 쿠키로 요청하면 같은 새 토큰을 받는다', async ({
                page,
                context
            }) => {
                const first = await page.goto('/api/users/me', { waitUntil: 'commit' })
                const late = await otherPage.goto('/api/users/me', { waitUntil: 'commit' })

                for (const response of [first, late]) {
                    expect(response?.status()).toBe(200)
                    expect(await response!.json()).toMatchObject({ email })
                }
                for (const [name, previous] of [
                    [ACCESS_COOKIE, 'invalid-access-token'],
                    [REFRESH_COOKIE, refreshCookieBefore!.value]
                ] as const) {
                    const issued = await getSessionCookie(context, name)
                    const reused = await getSessionCookie(otherPage.context(), name)
                    expect(issued?.value).toEqual(expect.stringMatching(/\S/))
                    expect(issued?.value === previous).toBe(false)
                    expect(reused?.value === issued?.value).toBe(true)
                }
            })
            test('동시에 요청하면 둘 다 성공하고 같은 새 갱신 쿠키를 받는다', async ({
                page,
                context
            }) => {
                const responses = await Promise.all([
                    page.goto('/api/users/me'),
                    otherPage.goto('/api/users/me')
                ])
                expect(responses.map((response) => response?.status())).toEqual([200, 200])

                const first = await getSessionCookie(context, REFRESH_COOKIE)
                const second = await getSessionCookie(otherPage.context(), REFRESH_COOKIE)
                expect(first).toBeDefined()
                expect(first!.value === refreshCookieBefore!.value).toBe(false)
                expect(second?.value === first!.value).toBe(true)
            })
        })
        test.describe('API에서 해당 세션을 로그아웃했으면', () => {
            test.beforeEach(async ({ request: api }) => {
                const logout = await api.post(`${API_BASE_URL}/users/logout`, {
                    data: { refreshToken: refreshCookieBefore!.value }
                })
                expect(logout.status()).toBe(204)
            })
            test('본인 정보를 요청하면 401을 반환하고 두 인증 쿠키를 지운다', async ({
                page,
                context
            }) => {
                const response = await page.goto('/api/users/me')
                expect(response?.status()).toBe(401)
                expect(await getSessionCookie(context, ACCESS_COOKIE)).toBeUndefined()
                expect(await getSessionCookie(context, REFRESH_COOKIE)).toBeUndefined()
            })
        })
        test.describe('다른 요청이 갱신 토큰을 먼저 교체했으면', () => {
            test.beforeEach(async ({ request: api }) => {
                const refresh = await api.post(`${API_BASE_URL}/users/refresh`, {
                    data: { refreshToken: refreshCookieBefore!.value }
                })
                expect(refresh.status()).toBe(200)
            })
            test('보호 API 요청에 갱신 충돌을 전달하고 쿠키를 덮어쓰지 않는다', async ({
                page,
                request: api
            }) => {
                const conflict = await api.post(`${API_BASE_URL}/users/refresh`, {
                    data: { refreshToken: refreshCookieBefore!.value }
                })
                expect(conflict.status()).toBe(409)
                const { code, message } = await conflict.json()
                const response = await page.goto('/api/users/me')
                expect(response?.status()).toBe(409)
                expect(await response?.json()).toEqual({ code, message })
                expect(await response?.headerValue('set-cookie')).toBeNull()
            })
        })
        test('보호 API를 요청하면 토큰을 갱신하고 성공 응답을 반환한다', async ({
            context,
            page
        }) => {
            const status = await page.evaluate(async () => (await fetch('/api/users/me')).status)
            expect(status).toBe(200)

            const accessCookieAfter = await getSessionCookie(context, ACCESS_COOKIE)
            const refreshCookieAfter = await getSessionCookie(context, REFRESH_COOKIE)
            expect(accessCookieAfter).toMatchObject({ value: expect.any(String) })
            expect(refreshCookieAfter).toMatchObject({ value: expect.any(String) })
            expect(accessCookieAfter?.value).not.toBe('invalid-access-token')
            expect(refreshCookieAfter?.value).not.toBe(refreshCookieBefore?.value)
        })
    })
})

test.describe('가입 양식에 사진을 첨부한 뒤', () => {
    let email: string
    test.beforeEach(async ({ page }) => {
        email = `photo-${randomUUID()}@example.com`
        await page.goto(`${WEB_BASE_URL}/signup`)
        await page.getByRole('textbox', { name: '이름' }).fill('Photo User')
        await page.getByRole('textbox', { name: '이메일' }).fill(email)
        await page.getByLabel('비밀번호').fill(PASSWORD)
        await page
            .getByLabel('사진 (선택)')
            .setInputFiles(`${WORKSPACE_ROOT}/apps/api/api-docs/assets/image.png`)
    })
    test('가입하고 로그인하면 본인 정보와 업로드한 사진을 표시한다', async ({ page }) => {
        await page.getByRole('button', { name: '회원가입' }).click()
        await expect(page).toHaveURL(`${WEB_BASE_URL}/login`)
        await page.getByRole('textbox', { name: '이메일' }).fill(email)
        await page.getByLabel('비밀번호').fill(PASSWORD)
        await page.getByRole('button', { name: '로그인' }).click()
        await expect(page.getByText(email)).toBeVisible()
        const photo = page.getByRole('img', { name: 'Photo User의 프로필 사진' })
        await expect(photo).toBeVisible()
        await expect
            .poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
            .toBeGreaterThan(0)
    })
    test.describe('사진 전송이 실패하면', () => {
        test.beforeEach(async ({ page }) => {
            await page.route(
                (url) => url.pathname === '/storage',
                (route) => route.fulfill({ status: 503, body: 'Storage unavailable' })
            )
        })
        test('가입 화면에 실패를 표시하고 계정을 만들지 않는다', async ({ page, request: api }) => {
            await page.getByRole('button', { name: '회원가입' }).click()
            await expect(page.getByRole('alert').filter({ hasText: '사진' })).toContainText(
                '사진 업로드에 실패했습니다.'
            )
            await expect(page).toHaveURL(`${WEB_BASE_URL}/signup`)
            const login = await api.post(`${API_BASE_URL}/users/login`, {
                data: { email, password: PASSWORD }
            })
            expect(login.status()).toBe(401)
        })
    })
})
