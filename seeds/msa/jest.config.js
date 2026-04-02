const { createJsWithTsPreset, pathsToModuleNameMapper } = require('ts-jest')
const tsconfig = require('./tsconfig.json')

const tsJestPreset = createJsWithTsPreset({ tsconfig: 'tsconfig.json' })
const { compilerOptions } = tsconfig

module.exports = {
    ...tsJestPreset,
    globalSetup: '<rootDir>/jest.global.js',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '(__tests__/.*\\.spec\\.(ts|js))$',
    testEnvironment: 'node',
    resetModules: true,
    resetMocks: true,
    restoreMocks: true,
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
        '/config/configure-app\\.ts$',
        '/index\\.ts$',
        '\\.module\\.ts$',
        '/workflows/'
    ],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 60 * 1000
}
