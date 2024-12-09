import type { Config } from 'jest'

const config: Config = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    roots: ['<rootDir>/src'],
    testRegex: '.*\\.spec\\.(ts|js)$',
    moduleNameMapper: {
        '^app/(.*)$': '<rootDir>/src/app/$1',
        '^services/(.*)$': '<rootDir>/src/app/services/$1',
        '^common$': '<rootDir>/src/libs/common/index',
        '^testlib$': '<rootDir>/src/libs/testlib/index',
        '^config$': '<rootDir>/src/app/config/index'
    },
    testEnvironment: 'node',
    transform: { '^.+\\.ts$': 'ts-jest' },
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    collectCoverageFrom: [
        'src/app/**/*.ts',
        '!src/app/*.ts',
        'src/libs/common/**/*.ts',
        '!**/index.ts',
        '!**/*.module.ts',
    ],
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: ['__tests__'],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 10000
}

export default config
