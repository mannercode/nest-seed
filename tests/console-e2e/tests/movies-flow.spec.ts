import { expect, test } from '@playwright/test'

/**
 * 시드 admin으로 로그인해 새 영화를 등록하는 스모크 테스트이다.
 * admin 계정은 `apps/api/src/bootstrap.ts`의 dev seed가 만든다.
 */
test('admin으로 로그인하고 새 영화를 등록한다', async ({ page }) => {
    const stamp = Date.now()
    const title = `E2E 영화 ${stamp}`

    await page.goto('/login')
    await page.getByRole('textbox', { name: '이메일' }).fill('admin@nest-seed.local')
    await page.getByLabel('비밀번호').fill('DevPass1!')
    await page.getByRole('button', { name: '로그인' }).click()

    await expect(page).toHaveURL(/\/movies\/new$/)

    await page.getByRole('textbox', { name: '제목' }).fill(title)
    await page.getByRole('textbox', { name: '감독' }).fill('e2e-director')
    await page.getByRole('textbox', { name: '줄거리' }).fill('e2e plot')
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page).toHaveURL(/\/$/)
})
