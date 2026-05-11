const { join } = require('path')
const { createDefaultPreset } = require('ts-jest')
const baseConfig = require('../../jest.config.base')

const tsconfigPath = join(__dirname, 'tsconfig.json')
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })

// libs/testing은 infra 의존성이 없습니다. globalSetup/Teardown/setupFilesAfterEnv를 사용하지 않습니다.
// helper 들의 순수 unit test 라 Mongo/Redis/S3/NATS/Temporal 부팅 없이 실행됩니다.
module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    roots: ['<rootDir>/src'],
    // 후속 작업 대기 중이라 coverage는 비활성화 상태로 둠 — 많은 helper가
    // libs/common consumer를 통해 간접적으로만 호출됩니다.
    collectCoverageFrom: []
}
