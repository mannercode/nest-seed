import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import { createVitestBase } from '@mannercode/tools/vitest-config'

const libDir = path.dirname(fileURLToPath(import.meta.url))
const base = createVitestBase({ tsconfigPath: path.join(libDir, 'tsconfig.json') })

export default defineConfig({
    ...base,
    cacheDir: path.join(libDir, '_output/vite-cache'),
    resolve: { tsconfigPaths: true },
    test: {
        ...base.test,
        coverage: {
            reportsDirectory: path.join(libDir, '_output/coverage'),
            exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
            include: ['src/**/*.ts'],
            provider: 'v8',
            reporter: ['lcov', 'text-summary'],
            reportOnFailure: true,
            thresholds: { 100: true }
        },
        globalSetup: [path.join(libDir, 'vitest.global.cjs')],
        setupFiles: [path.join(libDir, 'src/__tests__/vitest.setup.ts')]
    }
})
