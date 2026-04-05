const { join } = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const tsconfig = require('./tsconfig.json')

const tsJestPreset = createDefaultPreset({ tsconfig: join(__dirname, 'tsconfig.json') })

module.exports = {
    ...tsJestPreset,
    globalSetup: join(__dirname, 'jest.global.js'),
    setupFilesAfterEnv: [join(__dirname, 'jest.setup.js')],
    testRegex: '(__tests__/.*\\.spec\\.ts)$',
    testEnvironment: 'node',
    resetModules: true,
    resetMocks: true,
    restoreMocks: true,
    moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
        prefix: join(__dirname, '/')
    }),
    coveragePathIgnorePatterns: ['__tests__', '/index\\.ts$'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    coverageReporters: ['lcov', 'text'],
    testTimeout: 60 * 1000
}
