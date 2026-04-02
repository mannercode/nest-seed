const { join } = require('path')
const { createJsWithTsPreset, pathsToModuleNameMapper } = require('ts-jest')
const tsconfig = require('./tsconfig.json')

const tsJestPreset = createJsWithTsPreset({ tsconfig: join(__dirname, 'tsconfig.json') })
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
