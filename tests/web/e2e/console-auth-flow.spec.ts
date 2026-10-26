import { expect, request, test, type BrowserContext, type Page } from '@playwright/test'
import { randomBytes, randomUUID } from 'node:crypto'

import { API_BASE_URL } from '../playwright.config'

const ADMIN_EMAIL = requiredEnvironment('ADMIN_EMAIL')
const ADMIN_PASSWORD = requiredEnvironment('ADMIN_PASSWORD')
const CROSS_ROLE_USER_NAME = 'Console Cross Role User'
const ACCESS_COOKIE = 'nest-seed-admin-access'
const REFRESH_COOKIE = 'nest-seed-admin-refresh'
const BFF_PAYLOAD_TOO_LARGE = {
    code: 'ERR_BFF_PAYLOAD_TOO_LARGE',
    message: 'Request body too large'
}

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be set by tests/web/compose.yml`)
    return value
}

async function login(page: Page): Promise<void> {
    await page.goto('/login')
    await page.getByRole('textbox', { name: '이메일' }).fill(ADMIN_EMAIL)
    await page.getByLabel('비밀번호').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(/\/movies\/new$/)
}

async function getSessionCookie(context: BrowserContext, name: string) {
    const cookies = await context.cookies()
    return cookies.find((cookie) => cookie.name === name)
}

for (const { condition, password } of [
    { condition: '이모지 14자', password: '🌱'.repeat(14) },
    { condition: '이모지 129자', password: '🌱'.repeat(129) }
]) {
    test.describe(`관리자 로그인 화면의 비밀번호가 ${condition}이면`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/login')
            await page.getByLabel('비밀번호').fill(password)
        })
        test('입력 원문을 유지하면서 길이 오류를 표시한다', async ({ page }) => {
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

test.describe('로그인하지 않았으면', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
    })
    test('관리자 세션 없이 극장 목록에 직접 접근하면 로그인으로 이동한다', async ({ page }) => {
        await page.goto('/theaters')

        await expect(page).toHaveURL(/\/login$/)
    })
    test.describe('일반 사용자 계정이 존재하면', () => {
        let email: string
        test.beforeEach(async ({ request: api }) => {
            email = `console-cross-role-user-${randomUUID()}@example.com`
            const userResponse = await api.post(`${API_BASE_URL}/users`, {
                data: {
                    birthDate: '2000-01-01',
                    email,
                    name: CROSS_ROLE_USER_NAME,
                    password: ADMIN_PASSWORD
                }
            })
            expect(userResponse.status()).toBe(201)
            const loginResponse = await api.post(`${API_BASE_URL}/users/login`, {
                data: { email, password: ADMIN_PASSWORD }
            })
            expect(loginResponse.status()).toBe(200)
        })
        for (const pathname of ['/api/users/login', '/api/USERS/LOGIN']) {
            test(`관리자 앱에서 ${pathname} 경로를 요청하면 토큰 없이 404를 반환한다`, async ({
                page
            }) => {
                const result = await page.evaluate(
                    async ({ email, password, pathname }) => {
                        const response = await fetch(pathname, {
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
                    { email, password: ADMIN_PASSWORD, pathname }
                )

                expect(result).toEqual({ exposesToken: false, status: 404 })
            })
        }
    })
    test('관리자 앱에서 토큰 갱신 경로를 직접 요청하면 404를 반환한다', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const response = await fetch('/api/admins/refresh', {
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
    test('로그인 요청을 반복하면 BFF가 전달한 IP별로 실패 횟수를 따로 계산한다', async ({
        page
    }) => {
        const stamp = randomUUID()
        const addressSeed = randomBytes(4).toString('hex')
        const firstIp = `2001:db8:${addressSeed.slice(0, 4)}:${addressSeed.slice(4)}::10`
        const secondIp = `2001:db8:${addressSeed.slice(0, 4)}:${addressSeed.slice(4)}::11`

        const result = await page.evaluate(
            async ({ firstIp, runId, secondIp }) => {
                async function failLogin(ip: string, sequence: number): Promise<number> {
                    const response = await fetch('/api/admins/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
                        body: JSON.stringify({
                            email: `missing-${runId}-${sequence}@example.com`,
                            password: 'definitely-wrong'
                        })
                    })
                    return response.status
                }

                const firstIpStatuses: number[] = []
                for (let sequence = 0; sequence < 51; sequence++) {
                    firstIpStatuses.push(await failLogin(firstIp, sequence))
                }
                const secondIpStatus = await failLogin(secondIp, 51)
                return { firstIpStatuses, secondIpStatus }
            },
            { firstIp, runId: stamp, secondIp }
        )

        expect(result.firstIpStatuses.slice(0, 50)).toEqual(Array(50).fill(401))
        expect(result.firstIpStatuses[50]).toBe(429)
        expect(result.secondIpStatus).toBe(401)
    })
    test.describe('요청 본문이 1MiB를 넘으면', () => {
        let requestBody: string

        test.beforeEach(() => {
            requestBody = JSON.stringify({ payload: 'x'.repeat(1024 * 1024 + 1) })
        })

        test('BFF로 요청하면 413을 반환한다', async ({ page }) => {
            const result = await page.evaluate(async (body) => {
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body
                })
                return { body: await response.json(), status: response.status }
            }, requestBody)

            expect(result).toEqual({ body: BFF_PAYLOAD_TOO_LARGE, status: 413 })
        })
    })
})

test.describe('관리자로 로그인했으면', () => {
    let accessCookie: Awaited<ReturnType<typeof getSessionCookie>>
    let refreshCookieBefore: Awaited<ReturnType<typeof getSessionCookie>>
    let loginHeaders: Array<{ name: string; value: string }>
    test.beforeEach(async ({ context, page }) => {
        const response = page.waitForResponse(
            (response) => new URL(response.url()).pathname === '/api/admins/login'
        )
        await login(page)
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
    test('보호 API를 요청하면 private, no-store 헤더를 반환한다', async ({ page }) => {
        const me = await page.evaluate(async () => {
            const response = await fetch('/api/admins/me')
            return { cacheControl: response.headers.get('cache-control'), status: response.status }
        })

        expect(me).toEqual({ cacheControl: 'private, no-store', status: 200 })
    })
    test('로그인 경로의 대소문자가 달라도 토큰은 본문 없이 쿠키로 전달한다', async ({
        context,
        page
    }) => {
        const result = await page.evaluate(
            async ({ email, password }) => {
                const response = await fetch('/api/Admins/Login', {
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
            { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
        )

        expect(result).toEqual({ exposesToken: false, hasBody: false, status: 204 })
        const refreshCookie = await getSessionCookie(context, REFRESH_COOKIE)
        expect(refreshCookie).toMatchObject({ httpOnly: true, value: expect.any(String) })
        expect(refreshCookie?.value === refreshCookieBefore?.value).toBe(false)
    })
    test('유효한 토큰으로 대소문자가 다른 갱신 경로를 요청하면 세션을 바꾸지 않고 404를 반환한다', async ({
        page,
        request: api
    }) => {
        expect(refreshCookieBefore).toBeDefined()
        const result = await page.evaluate(async (refreshToken) => {
            const response = await fetch('/api/Admins/Refresh', {
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
        const refresh = await api.post(`${API_BASE_URL}/admins/refresh`, {
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
                async (method) => (await fetch('/api/admins/logout', { method })).status,
                method
            )
            const accessAfter = await getSessionCookie(context, ACCESS_COOKIE)
            const refreshAfter = await getSessionCookie(context, REFRESH_COOKIE)
            const refresh = await api.post(`${API_BASE_URL}/admins/refresh`, {
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
    test.describe('로그아웃 요청이 BFF에 도달하기 전에 통신이 실패하면', () => {
        test.beforeEach(async ({ page }) => {
            expect(accessCookie).toBeDefined()
            expect(refreshCookieBefore).toBeDefined()
            await page.route('**/api/admins/logout', (route) => route.abort('failed'))
        })
        test('로그아웃 실패 시 쿠키와 화면을 유지하고 재시도하면 로그아웃을 완료한다', async ({
            context,
            page,
            request: api
        }) => {
            const currentUrl = page.url()
            const failed = page.waitForEvent(
                'requestfailed',
                (request) => new URL(request.url()).pathname === '/api/admins/logout'
            )
            await page.getByRole('button', { name: '로그아웃' }).click()
            await failed

            await expect.soft(page.locator('main [role="alert"]')).toBeVisible()
            expect(
                (await getSessionCookie(context, ACCESS_COOKIE))?.value === accessCookie?.value
            ).toBe(true)
            expect(
                (await getSessionCookie(context, REFRESH_COOKIE))?.value ===
                    refreshCookieBefore?.value
            ).toBe(true)
            await expect(page).toHaveURL(currentUrl)

            await page.unroute('**/api/admins/logout')
            await page.getByRole('button', { name: '로그아웃', exact: true }).click()
            await expect(page).toHaveURL(/\/login$/)
            expect(await getSessionCookie(context, ACCESS_COOKIE)).toBeUndefined()
            expect(await getSessionCookie(context, REFRESH_COOKIE)).toBeUndefined()
            const refresh = await api.post(`${API_BASE_URL}/admins/refresh`, {
                data: { refreshToken: refreshCookieBefore!.value }
            })
            expect(refresh.status()).toBe(401)
        })
    })
    test.describe('리프레시 쿠키가 잘못되어 API가 로그아웃을 거절하면', () => {
        test.beforeEach(async ({ context }) => {
            expect(refreshCookieBefore).toBeDefined()
            await context.addCookies([{ ...refreshCookieBefore!, value: 'invalid-refresh-token' }])
        })
        test('BFF는 쿠키를 지우고 화면은 실패를 표시하며 다시 로그아웃할 수 있다', async ({
            context,
            page
        }) => {
            const currentUrl = page.url()
            const response = page.waitForResponse(
                (response) => new URL(response.url()).pathname === '/api/admins/logout'
            )
            await page.getByRole('button', { name: '로그아웃', exact: true }).click()
            expect((await response).status()).toBe(401)
            await expect(page.locator('main [role="alert"]')).toBeVisible()
            await expect(page).toHaveURL(currentUrl)
            expect(await getSessionCookie(context, ACCESS_COOKIE)).toBeUndefined()
            expect(await getSessionCookie(context, REFRESH_COOKIE)).toBeUndefined()

            await page.getByRole('button', { name: '로그아웃', exact: true }).click()
            await expect(page).toHaveURL(/\/login$/)
        })
    })
    test('로그아웃하면 브라우저 쿠키와 서버의 리프레시 토큰을 폐기한다', async ({
        context,
        page
    }) => {
        const refreshCookie = await getSessionCookie(context, REFRESH_COOKIE)
        expect(refreshCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })

        await page.getByRole('button', { name: '로그아웃' }).click()
        await expect(page).toHaveURL(/\/login$/)
        expect(await getSessionCookie(context, ACCESS_COOKIE)).toBeUndefined()
        expect(await getSessionCookie(context, REFRESH_COOKIE)).toBeUndefined()

        const api = await request.newContext()
        try {
            const response = await api.post(`${API_BASE_URL}/admins/refresh`, {
                data: { refreshToken: refreshCookie!.value }
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
            const me = await page.evaluate(async () => {
                const response = await fetch('/api/admins/me')
                return { status: response.status, body: await response.json() }
            })
            expect(me.status).toBe(200)
            expect(me.body).toMatchObject({ email: ADMIN_EMAIL })

            const accessCookieAfter = await getSessionCookie(context, ACCESS_COOKIE)
            const refreshCookieAfter = await getSessionCookie(context, REFRESH_COOKIE)
            expect(accessCookieAfter).toMatchObject({ value: expect.any(String) })
            expect(refreshCookieAfter).toMatchObject({ value: expect.any(String) })
            expect(accessCookieAfter?.value).not.toBe('invalid-access-token')
            expect(refreshCookieAfter?.value).not.toBe(refreshCookieBefore?.value)
        })
        test('동시에 보호 API를 요청하면 모두 성공하고 갱신한 세션을 계속 사용할 수 있다', async ({
            context,
            page
        }) => {
            expect(accessCookie).toBeDefined()
            expect(refreshCookieBefore).toBeDefined()

            const statuses = await page.evaluate(async () => {
                const responses = await Promise.all([
                    fetch('/api/admins/me'),
                    fetch('/api/admins/me')
                ])
                return responses.map((response) => response.status)
            })
            expect(statuses).toEqual([200, 200])

            const accessCookieAfter = await getSessionCookie(context, ACCESS_COOKIE)
            const refreshCookieAfter = await getSessionCookie(context, REFRESH_COOKIE)
            expect(accessCookieAfter).toMatchObject({ value: expect.any(String) })
            expect(refreshCookieAfter).toMatchObject({ value: expect.any(String) })
            expect(accessCookieAfter?.value).not.toBe('invalid-access-token')
            expect(refreshCookieAfter?.value).not.toBe(refreshCookieBefore?.value)
            expect(await page.evaluate(async () => (await fetch('/api/admins/me')).status)).toBe(
                200
            )
        })
    })
})
