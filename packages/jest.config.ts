import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createJsWithTsPreset, pathsToModuleNameMapper } from 'ts-jest'

const configDir = dirname(fileURLToPath(import.meta.url))
const tsJestPreset = createJsWithTsPreset({ tsconfig: join(configDir, 'tsconfig.json') })

import tsconfig from './tsconfig.json' with { type: 'json' }
const { compilerOptions } = tsconfig

export default {
    ...tsJestPreset,
    globalSetup: '<rootDir>/jest.global.ts',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '(__tests__/.*\\.spec\\.(ts|js))$',
    testEnvironment: 'node',
    resetModules: true,
    resetMocks: true,
    restoreMocks: true,
    roots: ['<rootDir>'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    collectCoverageFrom: [
        '<rootDir>/*/src/**/*.ts',
        '!<rootDir>/testing/src/**/*.ts',
        '!<rootDir>/*/src/**/*.d.ts'
    ],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: ['__tests__', '/index\\.ts$', '/dist/'],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 60 * 1000
}
