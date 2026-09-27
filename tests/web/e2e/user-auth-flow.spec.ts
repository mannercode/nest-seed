import { expect, request, test, type BrowserContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

import { API_BASE_URL, USER_APP_BASE_URL } from '../playwright.config'

const PASSWORD = 'DevPass1!'
const ADMIN_EMAIL = requiredEnvironment('ADMIN_EMAIL')
const ADMIN_PASSWORD = requiredEnvironment('ADMIN_PASSWORD')
const ACCESS_COOKIE = 'nest-seed-user-access'
const REFRESH_COOKIE = 'nest-seed-user-refresh'

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be set by tests/web/compose.yml`)
    return value
}

async function signupAndLogin(page: Page): Promise<string> {
    const email = `e2e-user-${randomUUID()}@example.com`

    await page.goto(`${USER_APP_BASE_URL}/signup`)
    await page.getByRole('textbox', { name: '이름' }).fill('E2E User')
    await page.getByRole('textbox', { name: '이메일' }).fill(email)
    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '회원가입' }).click()
    await expect(page).toHaveURL(`${USER_APP_BASE_URL}/login`)

    await page.getByRole('textbox', { name: '이메일' }).fill(email)
    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(`${USER_APP_BASE_URL}/`)

    return email
}

async function getSessionCookie(context: BrowserContext, name: string) {
    const cookies = await context.cookies(USER_APP_BASE_URL)
    return cookies.find((cookie) => cookie.name === name)
}

test.describe('로그인하지 않았으면', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${USER_APP_BASE_URL}/login`)
    })
    test('사용자 앱에서 관리자 로그인 경로를 요청하면 토큰 없이 404를 반환한다', async ({
        page
    }) => {
        const result = await page.evaluate(
            async ({ email, password }) => {
                const response = await fetch('/api/admins/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                })
                const body = await response.text()
                return {
                    exposesToken: /"(?:accessToken|refreshToken)"\s*:/.test(body),
                    status: response.status
                }
            },
            { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
        )

        expect(result).toEqual({ exposesToken: false, status: 404 })
    })
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

test.describe('사용자로 로그인했으면', () => {
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
    test('로그인 쿠키에 HttpOnly·SameSite와 토큰 만료 시각을 설정한다', async () => {
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
    test('보호 API와 홈을 요청하면 본인 정보와 영화 목록을 반환한다', async ({ page }) => {
        const me = await page.evaluate(async () => {
            const response = await fetch('/api/users/me')
            return { body: (await response.json()) as { email: string }, status: response.status }
        })
        expect(me).toEqual({ body: expect.objectContaining({ email }), status: 200 })

        const home = await page.evaluate(async () => {
            const response = await fetch('/api/views/user-app/home')
            return {
                body: (await response.json()) as {
                    recommendedMovies: unknown[]
                    showingMovies: unknown[]
                },
                status: response.status
            }
        })
        expect(home).toEqual({
            body: { recommendedMovies: expect.any(Array), showingMovies: expect.any(Array) },
            status: 200
        })
        await expect(page.getByText(email)).toBeVisible()
    })
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
    test.describe('액세스 쿠키의 토큰이 잘못되었으면', () => {
        test.beforeEach(async ({ context }) => {
            await context.addCookies([{ ...accessCookie!, value: 'invalid-access-token' }])
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
