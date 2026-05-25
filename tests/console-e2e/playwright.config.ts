import { defineConfig, devices } from '@playwright/test'

const API_PORT = 3000
const CONSOLE_PORT = 3100
const BASE_URL = `http://localhost:${CONSOLE_PORT}`

/**
 * API와 console dev 서버를 시작한 뒤 테스트를 실행한다.
 * 이미 `npm run dev` 로 실행 중이면 그대로 재사용한다.
 * Mongo, Redis, NATS, Temporal 같은 인프라는 `infra`가 먼저 시작해 두어야 한다.
 */
export default defineConfig({
    testDir: './tests',
    // 다른 워크스페이스와 같은 `_output` 패턴을 따른다.
    // test-results가 작업 디렉터리에 흩어지지 않도록 한곳에 모은다.
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
