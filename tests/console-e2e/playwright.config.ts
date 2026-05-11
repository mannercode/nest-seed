import { defineConfig, devices } from '@playwright/test'

const API_PORT = 3000
const CONSOLE_PORT = 3100
const BASE_URL = `http://localhost:${CONSOLE_PORT}`

/**
 * api + console dev 서버를 띄운 뒤 테스트 실행. 이미 `npm run dev` 가 떠 있다면
 * 그대로 재사용한다. mongo/redis/nats/temporal 인프라는 .devcontainer/infra 에서
 * 미리 떠 있어야 한다.
 */
export default defineConfig({
    testDir: './tests',
    // 다른 워크스페이스와 동일한 `_output` 패턴. test-results 가 cwd 에
    // 흩어지지 않게 한곳에 모은다.
    outputDir: './_output/test-results',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['list']],
    use: { baseURL: BASE_URL, trace: 'on-first-retry' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        {
            command: 'npm run dev -w apps/api',
            url: `http://localhost:${API_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            cwd: '../..'
        },
        {
            command: 'npm run dev -w apps/console',
            url: BASE_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            cwd: '../..'
        }
    ]
})
