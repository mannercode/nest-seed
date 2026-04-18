const { join } = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const baseConfig = require('../jest.config.base')
const tsconfig = require('./tsconfig.json')

const tsJestPreset = createDefaultPreset({ tsconfig: join(__dirname, 'tsconfig.json') })

module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    globalSetup: join(__dirname, 'jest.global.js'),
    globalTeardown: join(__dirname, 'jest.teardown.js'),
    setupFilesAfterEnv: [join(__dirname, 'jest.setup.js')],
    moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
        prefix: join(__dirname, '/')
    }),
    roots: ['<rootDir>/src'],
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coverageDirectory: '<rootDir>/_output/coverage',
    coveragePathIgnorePatterns: ['__tests__', '/index\\.ts$']
}
