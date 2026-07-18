import { expect, request, test } from '@playwright/test'

import { API_BASE_URL } from '../playwright.config'

// API가 admin을 자동 생성하지 않으므로 root로 만들고 기존 계정의 409는 허용한다.

const ADMIN_EMAIL = 'admin@nest-seed.local'
const ADMIN_PASSWORD = 'DevPass1!'
const ADMIN_NAME = 'Admin'

const rootPassword = process.env.ROOT_PASSWORD
if (!rootPassword) {
    throw new Error('ROOT_PASSWORD must be set (devcontainer ambient env에서 주입된다)')
}
const ROOT_BASIC_AUTH = `Basic ${Buffer.from(`root:${rootPassword}`).toString('base64')}`

test.beforeAll(async () => {
    const ctx = await request.newContext()
    try {
        const res = await ctx.post(`${API_BASE_URL}/admins`, {
            data: { email: ADMIN_EMAIL, name: ADMIN_NAME, password: ADMIN_PASSWORD },
            headers: { Authorization: ROOT_BASIC_AUTH }
        })
        if (!res.ok() && res.status() !== 409) {
            throw new Error(`admin creation failed: ${res.status()} ${await res.text()}`)
        }
    } finally {
        await ctx.dispose()
    }
})

test('admin으로 로그인하고 새 영화를 등록한다', async ({ page }) => {
    const stamp = Date.now()
    const title = `E2E 영화 ${stamp}`

    await page.goto('/login')
    await page.getByRole('textbox', { name: '이메일' }).fill(ADMIN_EMAIL)
    await page.getByLabel('비밀번호').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: '로그인' }).click()

    await expect(page).toHaveURL(/\/movies\/new$/)

    await page.getByRole('textbox', { name: '제목' }).fill(title)
    await page.getByRole('textbox', { name: '감독' }).fill('e2e-director')
    await page.getByRole('textbox', { name: '줄거리' }).fill('e2e plot')
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page).toHaveURL(/\/$/)

    // 목록 화면이 없어 API read-back으로 저장까지 확인한다.
    const ctx = await request.newContext()
    try {
        await expect
            .poll(
                async () => {
                    const res = await ctx.get(
                        `${API_BASE_URL}/movies?page=1&size=50&title=${encodeURIComponent(title)}`
                    )
                    if (!res.ok()) return false
                    const body = await res.json()
                    return body.items.some((m: { title: string }) => m.title === title)
                },
                { timeout: 10_000 }
            )
            .toBe(true)
    } finally {
        await ctx.dispose()
    }
})
