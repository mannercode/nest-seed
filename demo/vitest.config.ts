import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        isolate: true,
        pool: 'forks',
        sequence: { concurrent: false, hooks: 'list', setupFiles: 'list' },
        setupFiles: ['./src/__tests__/setup.ts'],
        testTimeout: 10_000
    }
})
