import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defaultExclude, defineConfig } from 'vitest/config'

import { createVitestBase } from '@mannercode/tools/vitest-config'

const libDir = path.dirname(fileURLToPath(import.meta.url))
const base = createVitestBase({ tsconfigPath: path.join(libDir, 'tsconfig.json') })
const { include: allSpecs, ...sharedTestOptions } = base.test
const containerFreeSpecs = [
    'src/{config,date-time-range,idempotency,lat-long,logger,pagination,restate,utils}/**/__tests__/**/*.spec.ts',
    'src/auth/__tests__/guards.spec.ts',
    'src/health/__tests__/restate.health-indicator.spec.ts',
    'src/mongodb/__tests__/mongo.util.spec.ts',
    'src/redis/__tests__/redis.module.cluster.spec.ts'
]

export default defineConfig({
    ...base,
    cacheDir: path.join(libDir, '_output/vite-cache'),
    resolve: { tsconfigPaths: true },
    test: {
        ...sharedTestOptions,
        coverage: {
            reportsDirectory: path.join(libDir, '_output/coverage'),
            exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
            include: ['src/**/*.ts'],
            provider: 'v8',
            reporter: ['lcov', 'text-summary'],
            reportOnFailure: true,
            thresholds: { 100: true }
        },
        setupFiles: ['reflect-metadata'],
        projects: [
            { test: { name: 'local', include: containerFreeSpecs } },
            {
                test: {
                    name: 'containers',
                    include: allSpecs,
                    exclude: [...defaultExclude, ...containerFreeSpecs],
                    globalSetup: [path.join(libDir, 'vitest.global.cjs')],
                    setupFiles: [path.join(libDir, 'src/__tests__/vitest.setup.ts')]
                }
            }
        ]
    }
})
