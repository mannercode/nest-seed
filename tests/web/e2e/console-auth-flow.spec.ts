import { expect, request, test, type BrowserContext, type Page } from '@playwright/test'
import { randomBytes, randomUUID } from 'node:crypto'

import { API_BASE_URL } from '../playwright.config'

const ADMIN_EMAIL = requiredEnvironment('ADMIN_EMAIL')
const ADMIN_PASSWORD = requiredEnvironment('ADMIN_PASSWORD')
const CROSS_ROLE_USER_EMAIL = 'console-cross-role-user@nest-seed.local'
const CROSS_ROLE_USER_NAME = 'Console Cross Role User'
const ACCESS_COOKIE = 'nest-seed-admin-access'
const REFRESH_COOKIE = 'nest-seed-admin-refresh'
const BFF_PAYLOAD_TOO_LARGE = {
    code: 'ERR_BFF_PAYLOAD_TOO_LARGE',
    message: 'Request body too large'
}

test.beforeAll(async () => {
    const api = await request.newContext()
    try {
        const userResponse = await api.post(`${API_BASE_URL}/users`, {
            data: {
                birthDate: '2000-01-01',
                email: CROSS_ROLE_USER_EMAIL,
                name: CROSS_ROLE_USER_NAME,
                password: ADMIN_PASSWORD
            }
        })
        if (!userResponse.ok() && userResponse.status() !== 409) {
            throw new Error(
                `cross-role user creation failed: ${userResponse.status()} ${await userResponse.text()}`
            )
        }
    } finally {
        await api.dispose()
    }
})

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

test('관리자 세션 없이 극장 목록에 직접 접근하면 로그인으로 이동한다', async ({ page }) => {
    await page.goto('/theaters')

    await expect(page).toHaveURL(/\/login$/)
})

test('교차 역할 사용자 로그인 경로는 console BFF에서 토큰을 노출하지 않고 404다', async ({
    page
}) => {
    await page.goto('/login')

    const result = await page.evaluate(
        async ({ email, password }) => {
            const response = await fetch('/api/users/login', {
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
        { email: CROSS_ROLE_USER_EMAIL, password: ADMIN_PASSWORD }
    )

    expect(result).toEqual({ exposesToken: false, status: 404 })
})

test('관리자 refresh 직접 호출은 console BFF에서 404다', async ({ page }) => {
    await page.goto('/login')

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

test('관리자 세션은 HttpOnly 쿠키로 보호 API에 전달되고 만료 시 회전한다', async ({
    context,
    page
}) => {
    await login(page)

    const accessCookie = await getSessionCookie(context, ACCESS_COOKIE)
    const refreshCookieBefore = await getSessionCookie(context, REFRESH_COOKIE)
    expect(accessCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
    expect(refreshCookieBefore).toMatchObject({ httpOnly: true, sameSite: 'Lax' })

    await context.addCookies([{ ...accessCookie!, value: 'expired-access-token' }])

    const me = await page.evaluate(async () => {
        const response = await fetch('/api/admins/me')
        return { status: response.status, body: await response.json() }
    })
    expect(me.status).toBe(200)
    expect(me.body).toMatchObject({ email: ADMIN_EMAIL })

    const accessCookieAfter = await getSessionCookie(context, ACCESS_COOKIE)
    const refreshCookieAfter = await getSessionCookie(context, REFRESH_COOKIE)
    expect(accessCookieAfter?.value).not.toBe('expired-access-token')
    expect(refreshCookieAfter?.value).not.toBe(refreshCookieBefore?.value)
})

test('관리자 보호 응답은 브라우저와 중간 캐시에 저장되지 않는다', async ({ page }) => {
    await login(page)

    const me = await page.evaluate(async () => {
        const response = await fetch('/api/admins/me')
        return { cacheControl: response.headers.get('cache-control'), status: response.status }
    })

    expect(me).toEqual({ cacheControl: 'private, no-store', status: 200 })
})

test('만료 access 토큰으로 동시 요청해도 refresh를 한 번만 회전하고 세션을 유지한다', async ({
    context,
    page
}) => {
    await login(page)

    const accessCookie = await getSessionCookie(context, ACCESS_COOKIE)
    const refreshCookieBefore = await getSessionCookie(context, REFRESH_COOKIE)
    expect(accessCookie).toBeDefined()
    expect(refreshCookieBefore).toBeDefined()

    await context.addCookies([{ ...accessCookie!, value: 'expired-access-token' }])

    const statuses = await page.evaluate(async () => {
        const responses = await Promise.all([fetch('/api/admins/me'), fetch('/api/admins/me')])
        return responses.map((response) => response.status)
    })
    expect(statuses).toEqual([200, 200])

    const accessCookieAfter = await getSessionCookie(context, ACCESS_COOKIE)
    const refreshCookieAfter = await getSessionCookie(context, REFRESH_COOKIE)
    expect(accessCookieAfter?.value).not.toBe('expired-access-token')
    expect(refreshCookieAfter?.value).not.toBe(refreshCookieBefore?.value)
    expect(await page.evaluate(async () => (await fetch('/api/admins/me')).status)).toBe(200)
})

test('관리자 로그아웃은 쿠키와 서버 refresh 토큰을 함께 폐기한다', async ({ context, page }) => {
    await login(page)

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

test('BFF가 전달한 클라이언트 IP별로 로그인 실패 한도를 격리한다', async ({ page }) => {
    await page.goto('/login')
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

test('BFF는 1MiB를 넘는 요청 본문을 upstream 전에 거절한다', async ({ page }) => {
    await page.goto('/login')

    const result = await page.evaluate(async () => {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: 'x'.repeat(1024 * 1024 + 1) })
        })
        return { body: await response.json(), status: response.status }
    })

    expect(result).toEqual({ body: BFF_PAYLOAD_TOO_LARGE, status: 413 })
})
