import { expect, test } from '@playwright/test'

/**
 * 가입 → 로그인 → 영화 등록 → 목록 노출 까지 한번에 통과하는 스모크.
 * 각 실행마다 이메일을 유니크하게 만들어 DB 잔존 상태와 무관하게 돌게 한다.
 */
test('signup → login → create movie → list shows it', async ({ page }) => {
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
