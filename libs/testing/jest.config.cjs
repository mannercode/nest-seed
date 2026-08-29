const { join } = require('path')
const { createDefaultPreset } = require('ts-jest')
const baseConfig = require('../../jest.config.base')

const tsconfigPath = join(__dirname, 'tsconfig.jest.json')
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })

// libs/testing은 인프라 의존성이 없어 globalSetup, globalTeardown, setupFilesAfterEnv를 쓰지 않는다.
// 헬퍼의 순수 단위 테스트라 Mongo/Redis/S3/NATS/Restate 없이 실행된다.
module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    // 이 패키지는 Jest resetModules 동작 자체를 계약 테스트한다. 애플리케이션 모듈 격리에는 사용하지 않는다.
    resetModules: true,
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
    // 이 워크스페이스 test 스크립트는 의도적으로 --coverage를 붙이지 않는다.
    // 헬퍼 대부분이 libs/common 사용자 코드를 통해 간접 검증되기 때문이다.
    roots: ['<rootDir>/src']
}
