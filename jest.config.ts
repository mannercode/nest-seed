import { createJsWithTsPreset, pathsToModuleNameMapper } from 'ts-jest'

const tsJestPreset = createJsWithTsPreset({ tsconfig: 'tsconfig.json' })

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
    roots: ['<rootDir>/packages'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    collectCoverageFrom: [
        '<rootDir>/packages/*/src/**/*.ts',
        '!<rootDir>/packages/testing/src/**/*.ts'
    ],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: ['__tests__', '/index\\.ts$'],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 60 * 1000
}
