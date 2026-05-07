const { join } = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const baseConfig = require('../../jest.config.base')
const tsconfig = require('../tsconfig.json')

const libsTsconfigPath = join(__dirname, '..', 'tsconfig.json')
const tsJestPreset = createDefaultPreset({ tsconfig: libsTsconfigPath })

// libs/testing has no infra dependency — no globalSetup/Teardown/setupFilesAfterEnv.
// Its tests are pure unit tests of helpers and run without booting Mongo/Redis/S3/NATS/Temporal.
module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
        prefix: join(__dirname, '..', '/')
    }),
    roots: ['<rootDir>/src'],
    // Coverage left disabled here pending a follow-up — many helpers are
    // exercised only indirectly by libs/common consumers.
    collectCoverageFrom: []
}
