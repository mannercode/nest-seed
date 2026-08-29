import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import { createVitestBase } from '../../vitest.config.base.mjs'

const libraryDirectory = path.dirname(fileURLToPath(import.meta.url))
const base = createVitestBase({ tsconfigPath: path.join(libraryDirectory, 'tsconfig.json') })

export default defineConfig({
    ...base,
    cacheDir: path.join(libraryDirectory, '_output/vite-cache'),
    resolve: {
        alias: { '@mannercode/testing': path.resolve(libraryDirectory, '../testing/src/index.ts') }
    },
    test: {
        ...base.test,
        coverage: {
            reportsDirectory: path.join(libraryDirectory, '_output/coverage'),
            exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
            include: ['src/**/*.ts'],
            provider: 'v8',
            reporter: ['lcov', 'text-summary'],
            reportOnFailure: true,
            thresholds: { 100: true }
        },
        globalSetup: [path.join(libraryDirectory, 'vitest.global.cjs')],
        setupFiles: [path.join(libraryDirectory, 'src/__tests__/vitest.setup.ts')]
    }
})
