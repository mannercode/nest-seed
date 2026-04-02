const { join } = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const tsconfig = require('./tsconfig.json')

const tsJestPreset = createDefaultPreset({ tsconfig: join(__dirname, 'tsconfig.json') })
const { compilerOptions } = tsconfig

module.exports = {
    ...tsJestPreset,
    globalSetup: '<rootDir>/jest.global.js',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testRegex: '(__tests__/.*\\.spec\\.ts)$',
    testEnvironment: 'node',
    resetModules: true,
    resetMocks: true,
    restoreMocks: true,
    roots: ['<rootDir>'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    collectCoverageFrom: ['<rootDir>/*/src/**/*.ts'],
    coveragePathIgnorePatterns: ['__tests__', '/index\\.ts$', '/testing/'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    coverageReporters: ['lcov', 'text'],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 60 * 1000
}
