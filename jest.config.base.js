/**
 * 모든 workspace jest config 의 공유 기본값. 구체 config
 * (libs/jest.config.js, apps/api/jest.config.js) 가 이 위에 globalSetup,
 * moduleNameMapper, coverage 규칙 등을 얹는다.
 */
module.exports = {
    testRegex: '(__tests__/.*\\.spec\\.ts)$',
    testEnvironment: 'node',
    resetModules: true,
    resetMocks: true,
    restoreMocks: true,
    // 통합 spec 은 매 it (beforeEach) 마다 createAppTestContext 로 AppModule 을
    // 통째 부팅한다. resetModules:true (격리는 의도) 는 모듈을 매 it fresh
    // evaluate 시키는데, 이전 evaluate 의 NestJS 클래스 instance 가 어딘가
    // strong ref (reflect-metadata global Map / mongoose connections 등) 로
    // 잡혀 GC 되지 못하고 native buffer (BSON/arrayBuffer) 가 it 당 ~16MB
    // 누적된다. 통합 spec 3 개만 돌아도 V8 heap 천장(~2.6GB)에 닿아 OOM.
    // 격리 의도와 framework 누적의 trade-off 는 후속 작업으로 미루고, 여기서는
    // 워커 RSS 가 1.5GB 도달하면 jest 가 워커를 회수(새 워커 fork)해 누적을
    // 끊는다. 1 GB 는 baseline 직후라 너무 잦은 회수, 2 GB 는 V8 heap 천장에
    // 너무 가까워 OOM 위험.
    workerIdleMemoryLimit: '10MB',
    coverageReporters: ['lcov', 'text'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    testTimeout: 60 * 1000
}
