import { defineConfig, devices } from '@playwright/test'

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is required for browser tests`)
    return value
}

export const API_BASE_URL = requiredEnvironment('API_BASE_URL')
export const WEB_BASE_URL = requiredEnvironment('WEB_BASE_URL')
export const S3_ENDPOINT = requiredEnvironment('S3_ENDPOINT')
export const S3_BUCKET = requiredEnvironment('S3_BUCKET')
export const WORKSPACE_ROOT = requiredEnvironment('WORKSPACE_ROOT')

export default defineConfig({
    testDir: './e2e',
    outputDir: './_output/test-results',
    forbidOnly: true,
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
