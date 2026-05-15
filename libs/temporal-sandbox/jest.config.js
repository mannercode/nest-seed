const { join } = require('path')
const { createDefaultPreset } = require('ts-jest')
const baseConfig = require('../../jest.config.base')

const tsconfigPath = join(__dirname, 'tsconfig.jest.json')
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })

module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    roots: ['<rootDir>/src'],
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coverageDirectory: '<rootDir>/_output/coverage',
    coveragePathIgnorePatterns: ['__tests__', '/index\\.ts$']
}
