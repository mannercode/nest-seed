import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import apiConfig from '../../../../vitest.config.mjs'

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url))
const apiDirectory = path.resolve(fixtureDirectory, '../../../..')

process.env.VITEST_ISOLATION_PROBE_COVERAGE_DIRECTORY = String(
    apiConfig.test.coverage.reportsDirectory
)
process.env.VITEST_ISOLATION_PROBE_OUTPUT_DIRECTORY =
    process.env.API_VITEST_OUTPUT_DIRECTORY ?? path.join(apiDirectory, '_output')

export default defineConfig({
    ...apiConfig,
    root: apiDirectory,
    test: {
        ...apiConfig.test,
        coverage: { ...apiConfig.test.coverage, enabled: false },
        include: ['src/__tests__/vitest-resource-isolation.spec.ts'],
        maxWorkers: 1,
        reporters: ['tree']
    }
})
