const path = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')

const appDir = process.cwd()
const tsconfigPath = path.resolve(appDir, 'tsconfig.json')
const tsconfig = require(tsconfigPath)
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })
const { compilerOptions } = tsconfig

module.exports = {
    ...tsJestPreset,
    globalSetup: path.resolve(__dirname, 'jest.global.js'),
    globalTeardown: path.resolve(__dirname, 'jest.teardown.js'),
    setupFilesAfterEnv: [path.resolve(__dirname, 'jest.setup.js')],
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '(__tests__/.*\\.spec\\.ts)$',
    testEnvironment: 'node',
    resetModules: true,
    resetMocks: true,
    restoreMocks: true,
    rootDir: appDir,
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
    // for ECM modules:
    // https://github.com/kulshekhar/ts-jest/tree/main/examples/js-with-ts
    // transformIgnorePatterns: ['/node_modules/(?!chalk)/']
}
