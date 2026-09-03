import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './contracts',
    outputDir: './_output/contract-results',
    forbidOnly: !!process.env.CI,
    reporter: [['list']]
})
