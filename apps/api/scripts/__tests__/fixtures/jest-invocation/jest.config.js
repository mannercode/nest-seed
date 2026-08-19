const path = require('node:path')

const apiDir = path.resolve(__dirname, '../../../..')
const apiConfig = require(path.join(apiDir, 'jest.config.js'))

process.env.JEST_ISOLATION_PROBE_COVERAGE_DIRECTORY = String(apiConfig.coverageDirectory)
process.env.JEST_ISOLATION_PROBE_OUTPUT_DIRECTORY =
    process.env.API_JEST_OUTPUT_DIRECTORY ?? path.join(apiDir, '_output')
process.env.JEST_ISOLATION_PROBE_WORKFLOW_DIRECTORY =
    process.env.API_JEST_WORKFLOW_DIRECTORY ?? path.join(apiDir, '_output/workflows')

module.exports = {
    ...apiConfig,
    collectCoverage: false,
    collectCoverageFrom: [],
    coverageThreshold: undefined,
    reporters: ['default'],
    rootDir: apiDir,
    roots: [path.join(apiDir, 'src/__tests__')],
    testRegex: 'jest-resource-isolation\\.spec\\.ts$'
}
