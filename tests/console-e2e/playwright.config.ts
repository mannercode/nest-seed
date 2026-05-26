import { defineConfig, devices } from '@playwright/test'

const API_PORT = 3000
const CONSOLE_PORT = 3100
const BASE_URL = `http://localhost:${CONSOLE_PORT}`

if (!process.env.WORKSPACE_ROOT) {
    throw new Error('WORKSPACE_ROOT must be set')
}
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT

/**
 * API와 console 빌드 결과물을 시작한 뒤 테스트를 실행한다.
 *
 * `next dev` / `nest start --watch`는 콜드 부팅이 길고(workflow 번들링 + 모듈
 * 로딩에 1~2분) 워처 오버헤드가 e2e에는 무의미하다. 빌드 결과물(`npm run start`)
 * 쪽이 더 빠르고 안정적이다.
 *
 * 이미 서버가 떠 있으면 그대로 재사용한다(`reuseExistingServer`).
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
            command: 'npm run build -w apps/api && npm run start -w apps/api',
            url: `http://localhost:${API_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
            cwd: WORKSPACE_ROOT
        },
        {
            command: 'npm run build -w apps/console && npm run start -w apps/console',
            url: BASE_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
            cwd: WORKSPACE_ROOT
        }
    ]
})
