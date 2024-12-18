import * as path from 'path'
import type { Config } from 'jest'

const config: Config = {
    setupFilesAfterEnv: [path.resolve(__dirname, 'jest.setup.ts')],
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '.*\\.spec\\.(ts|js)$',
    testEnvironment: 'node',
    transform: { '^.+\\.ts$': 'ts-jest' },
    rootDir: '..',
    moduleNameMapper: {
        '^common$': '<rootDir>/src/libs/common/index',
        '^testlib$': '<rootDir>/src/libs/testlib/index',
        '^types$': '<rootDir>/src/libs/types/index',
        '^proxy$': '<rootDir>/src/libs/proxy/index',
        '^config$': '<rootDir>/src/libs/config/index',
        '^services/(.*)$': '<rootDir>/src/apps/services/$1',
        '^gateway/(.*)$': '<rootDir>/src/apps/gateway/$1'
    },
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: ['__tests__'],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 10000
}

export default config
