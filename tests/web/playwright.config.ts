import { defineConfig, devices } from '@playwright/test'

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be set by the Dev Container`)
    return value
}

export const API_BASE_URL = `http://api:${requiredEnvironment('API_PORT')}`
export const WEB_BASE_URL = `http://web:${requiredEnvironment('WEB_PORT')}`

export default defineConfig({
    testDir: './e2e',
    outputDir: './_output/test-results',
    forbidOnly: !!process.env.CI,
    workers: 1,
    reporter: [['list'], ['html', { outputFolder: './_output/report', open: 'never' }]],
    use: { baseURL: WEB_BASE_URL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
