import { expect, request, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

import { API_BASE_URL } from '../playwright.config'

const ADMIN_EMAIL = requiredEnvironment('ADMIN_EMAIL')
const ADMIN_PASSWORD = requiredEnvironment('ADMIN_PASSWORD')

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

test.describe('관리자로 로그인했으면', () => {
    test.beforeEach(async ({ page }) => {
        await login(page)
    })
    test('새 영화를 저장하면 API 조회에서도 등록한 제목을 확인할 수 있다', async ({ page }) => {
        const stamp = randomUUID()
        const title = `E2E 영화 ${stamp}`

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
    test.describe('첫 영화 공개 요청이 503으로 실패하도록 설정하면', () => {
        let initialTitle: string
        let updatedTitle: string
        let createRequests: number
        let publishMovieIds: string[]
        let patches: Array<{ movieId: string; payload: unknown }>
        test.beforeEach(async ({ page }) => {
            const stamp = randomUUID()
            initialTitle = `E2E 공개 재시도 ${stamp}`
            updatedTitle = `${initialTitle} 수정`
            createRequests = 0
            publishMovieIds = []
            patches = []

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
        })
        test('공개 실패 후 내용을 수정해 저장하면 같은 초안으로 재시도한다', async ({ page }) => {
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
    })
    test('극장을 등록하면 극장 목록에 등록한 이름이 표시된다', async ({ page }) => {
        const name = `E2E 극장 ${randomUUID()}`

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
    test.describe('일반 사용자가 존재하면', () => {
        let email: string
        test.beforeEach(async () => {
            const stamp = randomUUID()
            email = `delete-me-${stamp}@example.com`
            const api = await request.newContext()
            try {
                const response = await api.post(`${API_BASE_URL}/users`, {
                    data: {
                        name: 'Delete Me',
                        email,
                        password: 'DevPass1!',
                        birthDate: '2000-01-01'
                    }
                })
                expect(response.status()).toBe(201)
            } finally {
                await api.dispose()
            }
        })
        test('사용자 목록에서 삭제하면 해당 사용자가 목록에서 사라진다', async ({ page }) => {
            await page.goto('/users')
            const row = page
                .getByTestId('user-list')
                .getByRole('listitem')
                .filter({ hasText: email })
            await expect(row).toBeVisible()
            page.once('dialog', (dialog) => dialog.accept())
            await row.getByRole('button', { name: '삭제' }).click()
            await expect(row).toHaveCount(0)
        })
    })
})
