import { defineConfig, devices } from '@playwright/test'

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be set by the Dev Container`)
    return value
}

const BASE_URL = `http://console:${requiredEnvironment('CONSOLE_PORT')}`
export const API_BASE_URL = `http://api:${requiredEnvironment('API_PORT')}`
export const USER_APP_BASE_URL = `http://user-app:${requiredEnvironment('USER_APP_PORT')}`

export default defineConfig({
    testDir: './e2e',
    outputDir: './_output/test-results',
    forbidOnly: !!process.env.CI,
    workers: 1,
    reporter: [['list'], ['html', { outputFolder: './_output/report', open: 'never' }]],
    use: { baseURL: BASE_URL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
