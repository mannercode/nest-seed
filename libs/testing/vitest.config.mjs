import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import { createVitestBase } from '../../vitest.config.base.mjs'

const libraryDirectory = path.dirname(fileURLToPath(import.meta.url))
const base = createVitestBase({ tsconfigPath: path.join(libraryDirectory, 'tsconfig.json') })

export default defineConfig({
    ...base,
    cacheDir: path.join(libraryDirectory, '_output/vite-cache'),
    test: {
        ...base.test,
        setupFiles: [path.join(libraryDirectory, 'src/__tests__/vitest.setup.ts')]
    }
})
