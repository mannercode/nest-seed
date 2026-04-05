const base = require('../jest.config.base')

module.exports = {
    ...base,
    roots: ['<rootDir>/src'],
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coverageDirectory: '<rootDir>/_output/coverage'
}
