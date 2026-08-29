import { defineConfig, devices } from '@playwright/test'

const API_PORT = process.env.API_PORT
const CONSOLE_PORT = process.env.CONSOLE_PORT
const USER_APP_PORT = process.env.USER_APP_PORT
if (!API_PORT || !CONSOLE_PORT || !USER_APP_PORT) {
    throw new Error(
        'API_PORT, CONSOLE_PORT and USER_APP_PORT must be set (devcontainer ambient env)'
    )
}
const BASE_URL = `http://localhost:${CONSOLE_PORT}`

export const API_BASE_URL = `http://localhost:${API_PORT}`
export const USER_APP_BASE_URL = `http://localhost:${USER_APP_PORT}`

if (!process.env.WORKSPACE_ROOT) {
    throw new Error('WORKSPACE_ROOT must be set')
}
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT

export default defineConfig({
    testDir: './e2e',
    outputDir: './_output/test-results',
    forbidOnly: !!process.env.CI,
    retries: Number(process.env.PLAYWRIGHT_RETRIES ?? 0),
    workers: 1,
    reporter: [
        ['list'],
        ['junit', { outputFile: './_output/junit.xml' }],
        ['html', { outputFolder: './_output/report', open: 'never' }]
    ],
    use: { baseURL: BASE_URL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        {
            command:
                "pnpm --filter './apps/api' --fail-if-no-match run build && pnpm --filter './apps/api' --fail-if-no-match run start",
            url: `${API_BASE_URL}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
            cwd: WORKSPACE_ROOT
        },
        {
            command:
                "BFF_TRUST_PROXY_HEADERS=true pnpm --filter './apps/console' --fail-if-no-match run build && BFF_TRUST_PROXY_HEADERS=true pnpm --filter './apps/console' --fail-if-no-match run start",
            url: BASE_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
            cwd: WORKSPACE_ROOT
        },
        {
            command:
                "BFF_TRUST_PROXY_HEADERS=true pnpm --filter './apps/user-app' --fail-if-no-match run build && BFF_TRUST_PROXY_HEADERS=true pnpm --filter './apps/user-app' --fail-if-no-match run start",
            url: USER_APP_BASE_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
            cwd: WORKSPACE_ROOT
        }
    ]
})
