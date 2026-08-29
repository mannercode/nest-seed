import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import { createVitestBase } from '../../vitest.config.base.mjs'
import VitestFailureDiagnosticsReporter from './scripts/vitest-failure-diagnostics-reporter.cjs'
import { initializeApiVitestRun } from './scripts/vitest-run-context.cjs'

const appDirectory = path.dirname(fileURLToPath(import.meta.url))
const base = createVitestBase({ tsconfigPath: path.join(appDirectory, 'tsconfig.json') })
const vitestRun = initializeApiVitestRun(appDirectory)
const source = (relativePath) => path.join(appDirectory, 'src', relativePath)

export default defineConfig({
    ...base,
    cacheDir: path.join(appDirectory, '_output/vite-cache'),
    resolve: {
        alias: {
            '#application': source('services/application/index.ts'),
            '#config': source('config/index.ts'),
            '#core': source('services/core/index.ts'),
            '#gateway': source('services/gateway/index.ts'),
            '#infrastructure': source('services/infrastructure/index.ts'),
            '#view': source('services/view/index.ts')
        }
    },
    test: {
        ...base.test,
        coverage: {
            reportsDirectory: vitestRun.coverageDirectory,
            exclude: ['src/**/__tests__/**', 'src/*.ts', 'src/**/index.ts', 'src/**/*.module.ts'],
            include: ['src/**/*.ts'],
            provider: 'v8',
            reporter: ['lcov', 'text-summary'],
            reportOnFailure: true,
            thresholds: { 100: true }
        },
        globalSetup: [path.join(appDirectory, 'vitest.global.cjs')],
        reporters: ['tree', new VitestFailureDiagnosticsReporter()],
        setupFiles: [path.join(appDirectory, 'src/__tests__/vitest.setup.ts')]
    }
})
