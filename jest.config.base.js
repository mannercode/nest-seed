/**
 * 모든 워크스페이스가 공유하는 Jest 기본값입니다. 워크스페이스별 설정은
 * 이 값을 펼친 뒤 `globalSetup`, `moduleNameMapper`, coverage 예외처럼
 * 자기 실행 환경에 필요한 항목만 덧붙입니다.
 */
module.exports = {
    testRegex: '(__tests__/.*\\.spec\\.ts)$',
    testEnvironment: 'node',
    resetMocks: true,
    restoreMocks: true,
    resetModules: true,
    // `resetModules: true`는 테스트 격리를 위해 필요하지만, 워커가 모듈 그래프를
    // 반복해서 만들며 메모리를 계속 점유합니다. 낮은 한도를 두어 워커를 자주
    // 교체하면 긴 테스트 실행에서도 메모리 사용량이 안정됩니다.
    workerIdleMemoryLimit: '1MB',
    coverageReporters: ['lcov', 'text'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    testTimeout: 60 * 1000
}
