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

test('교차 역할 관리자 로그인 경로는 user BFF에서 토큰을 노출하지 않고 404다', async ({ page }) => {
    await page.goto(`${USER_APP_BASE_URL}/login`)

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

test('사용자 refresh 직접 호출은 user BFF에서 404다', async ({ page }) => {
    await page.goto(`${USER_APP_BASE_URL}/login`)

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

test('사용자 로그인 세션으로 보호 API와 홈을 요청한다', async ({ page }) => {
    const email = await signupAndLogin(page)

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

test('access 토큰이 만료되면 refresh 토큰을 회전하고 원 요청을 한 번 재시도한다', async ({
    context,
    page
}) => {
    await signupAndLogin(page)

    const accessCookie = await getSessionCookie(context, ACCESS_COOKIE)
    const refreshCookieBefore = await getSessionCookie(context, REFRESH_COOKIE)
    expect(accessCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
    expect(refreshCookieBefore).toMatchObject({ httpOnly: true, sameSite: 'Lax' })

    await context.addCookies([{ ...accessCookie!, value: 'expired-access-token' }])

    const status = await page.evaluate(async () => (await fetch('/api/users/me')).status)
    expect(status).toBe(200)

    const accessCookieAfter = await getSessionCookie(context, ACCESS_COOKIE)
    const refreshCookieAfter = await getSessionCookie(context, REFRESH_COOKIE)
    expect(accessCookieAfter?.value).not.toBe('expired-access-token')
    expect(refreshCookieAfter?.value).not.toBe(refreshCookieBefore?.value)
})

test('로그아웃은 브라우저 쿠키를 지우고 서버 refresh 토큰도 폐기한다', async ({
    context,
    page
}) => {
    await signupAndLogin(page)

    const refreshCookie = await getSessionCookie(context, REFRESH_COOKIE)
    expect(refreshCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })

    await page.getByRole('button', { name: '로그아웃' }).click()

    await expect.poll(async () => getSessionCookie(context, ACCESS_COOKIE)).toBeUndefined()
    expect(await getSessionCookie(context, REFRESH_COOKIE)).toBeUndefined()
    expect(await page.evaluate(async () => (await fetch('/api/users/me')).status)).toBe(401)

    const api = await request.newContext()
    try {
        const response = await api.post(`${API_BASE_URL}/users/refresh`, {
            data: { refreshToken: refreshCookie!.value }
        })
        expect(response.status()).toBe(401)
    } finally {
        await api.dispose()
    }
})
