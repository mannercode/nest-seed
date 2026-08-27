import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './unit',
    outputDir: './_output/unit-results',
    forbidOnly: true,
    reporter: [['list']],
    workers: 1
})
