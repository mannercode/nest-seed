import { expect, test } from '@playwright/test'

/**
 * 가입, 로그인, 영화 등록, 목록 노출을 한 흐름으로 확인하는 스모크 테스트입니다.
 * 매번 새 이메일을 만들어 DB에 남은 이전 데이터와 충돌하지 않게 합니다.
 */
test('가입 후 로그인하고 새 영화를 등록하면 목록에 표시된다', async ({ page }) => {
    const stamp = Date.now()
    const email = `e2e-${stamp}@mail.com`
    const password = 'password123'
    const title = `E2E 영화 ${stamp}`

    await page.goto('/signup')
    await page.getByRole('textbox', { name: '이메일' }).fill(email)
    await page.getByRole('textbox', { name: '이름' }).fill('e2e-user')
    await page.getByLabel('비밀번호').fill(password)
    await page.getByRole('button', { name: '가입하기' }).click()

    await expect(page).toHaveURL(/\/login$/)

    await page.getByRole('textbox', { name: '이메일' }).fill(email)
    await page.getByLabel('비밀번호').fill(password)
    await page.getByRole('button', { name: '로그인' }).click()

    await expect(page).toHaveURL(/\/movies$/)
    await expect(page.getByRole('heading', { name: '영화 목록' })).toBeVisible()

    await page.getByRole('link', { name: '새 영화 등록' }).click()
    await expect(page).toHaveURL(/\/movies\/new$/)
    await page.getByRole('textbox', { name: '제목' }).fill(title)
    await page.getByRole('textbox', { name: '감독' }).fill('e2e-director')
    await page.getByRole('textbox', { name: '줄거리' }).fill('e2e plot')
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page).toHaveURL(/\/movies$/)
    await expect(page.getByTestId('movie-list').getByText(title)).toBeVisible()
})
