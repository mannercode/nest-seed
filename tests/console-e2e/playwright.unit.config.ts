import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './unit',
    outputDir: './_output/unit-results',
    fullyParallel: false,
    forbidOnly: true,
    reporter: [['list']],
    retries: 0,
    workers: 1
})
