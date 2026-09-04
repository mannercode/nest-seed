import { defineConfig, devices } from '@playwright/test'

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be set by tests/web/compose.yml`)
    return value
}

const BASE_URL = requiredEnvironment('CONSOLE_BASE_URL')
export const API_BASE_URL = requiredEnvironment('API_BASE_URL')
export const USER_APP_BASE_URL = requiredEnvironment('USER_APP_BASE_URL')

export default defineConfig({
    testDir: './e2e',
    outputDir: './_output/test-results',
    forbidOnly: !!process.env.CI,
    workers: 1,
    reporter: [['list'], ['html', { outputFolder: './_output/report', open: 'never' }]],
    use: { baseURL: BASE_URL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
