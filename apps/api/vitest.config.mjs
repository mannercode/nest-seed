import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { createVitestBase } from '../../vitest.config.base.mjs'

const appDirectory = path.dirname(fileURLToPath(import.meta.url))
const base = createVitestBase({ tsconfigPath: path.join(appDirectory, 'tsconfig.json') })

export default defineConfig({
    ...base,
    cacheDir: path.join(appDirectory, '_output/vite-cache'),
    resolve: { tsconfigPaths: true },
    test: {
        ...base.test,
        coverage: {
            reportsDirectory: path.join(appDirectory, '_output/coverage'),
            exclude: ['src/**/__tests__/**', 'src/*.ts', 'src/**/index.ts', 'src/**/*.module.ts'],
            include: ['src/**/*.ts'],
            provider: 'v8',
            reporter: ['lcov', 'text-summary'],
            reportOnFailure: true,
            thresholds: { 100: true }
        },
        globalSetup: [path.join(appDirectory, 'vitest.global.mjs')],
        setupFiles: [path.join(appDirectory, 'vitest.setup.ts')]
    }
})
