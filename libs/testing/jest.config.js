const { join } = require('path')
const { createDefaultPreset } = require('ts-jest')
const baseConfig = require('../../jest.config.base')

const tsconfigPath = join(__dirname, 'tsconfig.jest.json')
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })

// libs/testing은 인프라 의존성이 없어 globalSetup, globalTeardown,
// setupFilesAfterEnv를 쓰지 않는다.
// 헬퍼의 순수 단위 테스트라 Mongo/Redis/S3/NATS/Temporal 없이 실행된다.
module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    roots: ['<rootDir>/src'],
    // 많은 헬퍼가 libs/common 사용자 코드를 통해 간접 호출되므로 coverage는 잠시 비활성화한다.
    collectCoverageFrom: []
}
