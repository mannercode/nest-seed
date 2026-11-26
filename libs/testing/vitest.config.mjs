import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import { createVitestBase } from '@mannercode/tools/vitest-config'

const libDir = path.dirname(fileURLToPath(import.meta.url))
const base = createVitestBase({ tsconfigPath: path.join(libDir, 'tsconfig.json') })

export default defineConfig({ ...base, cacheDir: path.join(libDir, '_output/vite-cache') })
