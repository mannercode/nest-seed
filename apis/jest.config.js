const path = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const baseConfig = require('../jest.config.base')

const appDir = process.cwd()
const tsconfigPath = path.resolve(appDir, 'tsconfig.json')
const tsconfig = require(tsconfigPath)
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })
const { compilerOptions } = tsconfig

module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    globalSetup: path.resolve(__dirname, 'jest.global.js'),
    globalTeardown: path.resolve(__dirname, 'jest.teardown.js'),
    setupFilesAfterEnv: [path.resolve(__dirname, 'jest.setup.js')],
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: appDir,
    roots: ['<rootDir>/src'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    modulePaths: [compilerOptions.baseUrl],
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coveragePathIgnorePatterns: [
        '__tests__',
        '/production\\.ts$',
        '/development\\.ts$',
        '/main\\.ts$',
        '/config/configure-app\\.ts$',
        '/index\\.ts$',
        '\\.module\\.ts$',
        '/workflows'
    ],
    coverageDirectory: '<rootDir>/_output/coverage'
}
