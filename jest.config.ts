import type { Config } from 'jest'

const config: Config = {
    setupFilesAfterEnv: ['<rootDir>/configs/jest.setup-after.ts'],
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '.*\\.spec\\.(ts|js)$',
    testEnvironment: 'node',
    transform: { '^.+\\.ts$': 'ts-jest' },
    // This method only initialises the call count and instance information for all mock functions.
    clearMocks: true,
    // This method resets all calls and instances of the mock function.
    // It also deletes any implementations set on the mock function.
    resetMocks: true,
    restoreMocks: true,
    resetModules: true,
    rootDir: '.',
    roots: ['<rootDir>/src'],
    moduleNameMapper: {
        '^common$': '<rootDir>/src/libs/common/index',
        '^testlib$': '<rootDir>/src/libs/testlib/index',
        '^shared/(.*)$': '<rootDir>/src/apps/shared/$1',
        '^gateway$': '<rootDir>/src/apps/gateway/index',
        '^applications$': '<rootDir>/src/apps/applications/index',
        '^cores$': '<rootDir>/src/apps/cores/index',
        '^infrastructures$': '<rootDir>/src/apps/infrastructures/index'
    },
    collectCoverageFrom: [
        '!**/*.controller.ts',
        '!**/production.ts',
        '!**/development.ts',
        '!**/main.ts',
        '!**/modules/*',
        '!**/index.ts',
        '!**/*.module.ts'
    ],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: ['__tests__'],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 10000
}

export default config
