import type { Config } from 'jest'

const config: Config = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    roots: ['<rootDir>/apps','<rootDir>/libs'],
    testRegex: '.*\\.spec\\.(ts|js)$',
    moduleNameMapper: {
        '^common$': '<rootDir>/libs/common/index',
        '^testlib$': '<rootDir>/libs/testlib/index',
        '^types$': '<rootDir>/libs/@types/index',
        '^proxy$': '<rootDir>/libs/proxy/index',
        '^config$': '<rootDir>/libs/config/index',
        '^services/(.*)$': '<rootDir>/apps/services/src/$1',
        '^gateway/(.*)$': '<rootDir>/apps/gateway/src/$1'
    },
    testEnvironment: 'node',
    transform: { '^.+\\.ts$': 'ts-jest' },
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    collectCoverageFrom: [
        'src/app/**/*.ts',
        '!src/app/*.ts',
        'src/libs/common/**/*.ts',
        '!**/index.ts',
        '!**/*.module.ts'
    ],
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: ['__tests__'],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 10000
}

export default config
