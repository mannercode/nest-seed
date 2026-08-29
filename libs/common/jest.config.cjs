const { join } = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const baseConfig = require('../../jest.config.base')
const tsconfig = require('./tsconfig.json')

const tsconfigPath = join(__dirname, 'tsconfig.jest.json')
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })

module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    globalSetup: join(__dirname, 'jest.global.cjs'),
    globalTeardown: join(__dirname, 'jest.teardown.cjs'),
    setupFilesAfterEnv: [join(__dirname, 'jest.setup.cjs')],
    moduleNameMapper: {
        ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
            prefix: join(__dirname, '/')
        }),
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    roots: ['<rootDir>/src'],
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coverageDirectory: '<rootDir>/_output/coverage',
    coveragePathIgnorePatterns: ['__tests__', '/index\\.ts$']
}
