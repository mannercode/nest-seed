import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './contracts',
    outputDir: './_output/contract-results',
    forbidOnly: true,
    reporter: [['list']],
    workers: 1
})
