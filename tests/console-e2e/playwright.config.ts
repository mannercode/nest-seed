import { defineConfig, devices } from '@playwright/test'

const API_PORT = process.env.API_PORT
const CONSOLE_PORT = process.env.CONSOLE_PORT
if (!API_PORT || !CONSOLE_PORT) {
    throw new Error('API_PORT and CONSOLE_PORT must be set (devcontainer ambient env)')
}
const BASE_URL = `http://localhost:${CONSOLE_PORT}`

export const API_BASE_URL = `http://localhost:${API_PORT}`

if (!process.env.WORKSPACE_ROOT) {
    throw new Error('WORKSPACE_ROOT must be set')
}
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT

export default defineConfig({
    testDir: './tests',
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
            url: `${API_BASE_URL}/health`,
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
