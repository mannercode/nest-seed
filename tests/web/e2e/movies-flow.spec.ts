import { expect, request, test, type Page } from '@playwright/test'

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

async function login(page: Page): Promise<void> {
    await page.goto('/login')
    await page.getByRole('textbox', { name: '이메일' }).fill(ADMIN_EMAIL)
    await page.getByLabel('비밀번호').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(/\/movies\/new$/)
}

test('admin으로 로그인하고 새 영화를 등록한다', async ({ page }) => {
    const stamp = Date.now()
    const title = `E2E 영화 ${stamp}`

    await login(page)

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

test('공개가 일시 실패해도 같은 영화 초안을 수정해 재시도한다', async ({ page }) => {
    const stamp = Date.now()
    const initialTitle = `E2E 공개 재시도 ${stamp}`
    const updatedTitle = `${initialTitle} 수정`
    let createRequests = 0
    const publishMovieIds: string[] = []
    const patches: Array<{ movieId: string; payload: unknown }> = []

    page.on('request', (req) => {
        const path = new URL(req.url()).pathname
        if (req.method() === 'POST' && path === '/api/movies') {
            createRequests += 1
        }
        const patchMatch = path.match(/^\/api\/movies\/([^/]+)$/)
        if (req.method() === 'PATCH' && patchMatch) {
            patches.push({ movieId: patchMatch[1], payload: req.postDataJSON() })
        }
    })
    await page.route(/\/api\/movies\/[^/]+\/publish$/, async (route) => {
        const movieId = new URL(route.request().url()).pathname.split('/').at(-2)
        if (!movieId) throw new Error('publish movie id가 없다')
        publishMovieIds.push(movieId)
        if (publishMovieIds.length === 1) {
            await route.fulfill({
                body: JSON.stringify({
                    code: 'ERR_TEMPORARY_PUBLISH_FAILURE',
                    message: 'temporary publish failure'
                }),
                contentType: 'application/json',
                status: 503
            })
            return
        }
        await route.continue()
    })

    await login(page)
    await page.getByRole('textbox', { name: '제목' }).fill(initialTitle)
    await page.getByRole('textbox', { name: '감독' }).fill('first-director')
    await page.getByRole('textbox', { name: '줄거리' }).fill('first plot')
    await page.getByRole('button', { name: '저장' }).click()

    const partialSuccessAlert = page.locator('form').getByRole('alert')
    await expect(partialSuccessAlert).toContainText('초안은 저장되었습니다')
    const partialSuccessMessage = await partialSuccessAlert.textContent()
    await page.getByRole('textbox', { name: '제목' }).fill(updatedTitle)
    await page.getByRole('textbox', { name: '감독' }).fill('updated-director')
    await page.getByRole('textbox', { name: '줄거리' }).fill('updated plot')
    await page.getByRole('button', { name: '저장' }).click()
    await expect(page).toHaveURL(/\/$/)

    expect(createRequests).toBe(1)
    expect(publishMovieIds).toHaveLength(2)
    expect(new Set(publishMovieIds).size).toBe(1)
    expect(patches).toEqual([
        {
            movieId: publishMovieIds[0],
            payload: expect.objectContaining({
                director: 'updated-director',
                plot: 'updated plot',
                title: updatedTitle
            })
        }
    ])
    expect(partialSuccessMessage).toContain('초안은 저장되었습니다')
})

test('극장을 등록한 뒤 극장 목록에서 확인한다', async ({ page }) => {
    const name = `E2E 극장 ${Date.now()}`
    await login(page)

    await page.goto('/theaters/new')
    await page.getByRole('textbox', { name: '이름' }).fill(name)
    await page.getByRole('spinbutton', { name: '위도' }).fill('37.55')
    await page.getByRole('spinbutton', { name: '경도' }).fill('126.99')
    await page.getByRole('spinbutton', { name: '좌석 수 (1행)' }).fill('5')
    await page.getByRole('button', { name: '저장' }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/theaters')
    await expect(page.getByTestId('theater-list').getByText(name)).toBeVisible()
})

test('사용자 목록에서 사용자를 삭제한다', async ({ page }) => {
    const stamp = Date.now()
    const email = `delete-me-${stamp}@example.com`
    const api = await request.newContext()
    try {
        const response = await api.post(`${API_BASE_URL}/users`, {
            data: { name: 'Delete Me', email, password: 'DevPass1!', birthDate: '2000-01-01' }
        })
        expect(response.status()).toBe(201)
    } finally {
        await api.dispose()
    }

    await login(page)
    await page.goto('/users')
    const row = page.getByTestId('user-list').getByRole('listitem').filter({ hasText: email })
    await expect(row).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: '삭제' }).click()
    await expect(row).toHaveCount(0)
})
