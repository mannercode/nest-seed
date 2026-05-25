import { expect, request, test } from '@playwright/test'

const API_BASE_URL = 'http://localhost:3000'
const ROOT_PASSWORD = 'DevPass1!'
const ADMIN_EMAIL = 'admin@nest-seed.local'
const ADMIN_PASSWORD = 'DevPass1!'
const ADMIN_NAME = 'Admin'

// 시드 admin으로 로그인해 새 영화를 등록하는 스모크 테스트이다.
// admin은 API가 부팅 시 만들지 않으므로 테스트 시작 전에 root Basic Auth로 한 번 생성한다.
// 이미 있으면 409가 떨어지는데 무해하게 넘긴다.
test.beforeAll(async () => {
    const ctx = await request.newContext()
    try {
        const rootAuth = `Basic ${Buffer.from(`root:${ROOT_PASSWORD}`).toString('base64')}`
        const createRes = await ctx.post(`${API_BASE_URL}/admins`, {
            data: { email: ADMIN_EMAIL, name: ADMIN_NAME, password: ADMIN_PASSWORD },
            headers: { Authorization: rootAuth }
        })
        if (!createRes.ok() && createRes.status() !== 409) {
            throw new Error(
                `admin creation failed: ${createRes.status()} ${await createRes.text()}`
            )
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
})
