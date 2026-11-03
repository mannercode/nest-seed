import { defineConfig, devices } from '@playwright/test'

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be set by the Dev Container`)
    return value
}

export const API_BASE_URL = `http://api:${requiredEnvironment('API_PORT')}`
export const WEB_BASE_URL = `http://web.localhost:${requiredEnvironment('WEB_PORT')}`

export default defineConfig({
    testDir: './e2e',
    outputDir: './_output/test-results',
    forbidOnly: !!process.env.CI,
    workers: 1,
    reporter: [['list'], ['html', { outputFolder: './_output/report', open: 'never' }]],
    use: {
        baseURL: WEB_BASE_URL,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        // localhost 도메인을 Docker web에 연결해 Web Crypto를 표준 secure context에서 사용한다.
        launchOptions: { args: ['--host-resolver-rules=MAP web.localhost web'] }
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
