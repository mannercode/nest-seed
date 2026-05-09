const { join } = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const baseConfig = require('../../jest.config.base')
const tsconfig = require('../tsconfig.json')

const libsTsconfigPath = join(__dirname, '..', 'tsconfig.json')
const tsJestPreset = createDefaultPreset({ tsconfig: libsTsconfigPath })

// libs/testing 은 infra 의존성이 없다 — globalSetup/Teardown/setupFilesAfterEnv 미사용.
// helper 들의 순수 unit test 라 Mongo/Redis/S3/NATS/Temporal 부팅 없이 돈다.
module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
        prefix: join(__dirname, '..', '/')
    }),
    roots: ['<rootDir>/src'],
    // 후속 작업 대기 중이라 coverage 는 비활성화 상태로 둠 — 많은 helper 가
    // libs/common consumer 를 통해 간접적으로만 호출된다.
    collectCoverageFrom: []
}
