import { createJsWithTsPreset, pathsToModuleNameMapper } from 'ts-jest'
import tsconfig from './tsconfig.json' with { type: 'json' }

const tsJestPreset = createJsWithTsPreset({ tsconfig: 'tsconfig.json' })
const { compilerOptions } = tsconfig

export default {
    ...tsJestPreset,
    globalSetup: '<rootDir>/jest.global.ts',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '(__tests__/.*\\.spec\\.(ts|js))$',
    testEnvironment: 'node',
    resetModules: true, // Reset module cache between tests
    resetMocks: true, // Reset mock call counts/instances before each test
    restoreMocks: true, // Restore original implementations after each test
    rootDir: '.',
    roots: ['<rootDir>/src'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    modulePaths: [compilerOptions.baseUrl],
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: [
        '__tests__',
        '/production\\.ts$',
        '/development\\.ts$',
        '/main\\.ts$',
        '/shared/configure-app\\.ts$',
        '/modules/',
        '/index\\.ts$',
        '\\.module\\.ts$',
        '/libs/testlib/'
    ],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 60 * 1000
    // for ECM modules:
    // https://github.com/kulshekhar/ts-jest/tree/main/examples/js-with-ts
    // transformIgnorePatterns: ['/node_modules/(?!chalk)/']
}
