import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { createVitestBase } from '@mannercode/tools/vitest-config'

const appDir = path.dirname(fileURLToPath(import.meta.url))
const base = createVitestBase({ tsconfigPath: path.join(appDir, 'tsconfig.json') })

export default defineConfig({
    ...base,
    cacheDir: path.join(appDir, '_output/vite-cache'),
    resolve: { tsconfigPaths: true },
    test: {
        ...base.test,
        coverage: {
            reportsDirectory: path.join(appDir, '_output/coverage'),
            exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
            include: ['src/**/*.ts'],
            provider: 'v8',
            reporter: ['lcov', 'text-summary'],
            reportOnFailure: true,
            thresholds: { 100: true }
        },
        globalSetup: [path.join(appDir, 'vitest.global.ts')],
        setupFiles: [path.join(appDir, 'vitest.setup.ts')]
    }
})
