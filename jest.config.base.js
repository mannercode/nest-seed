/**
 * 모든 워크스페이스가 공유하는 Jest 기본값이다.
 * 워크스페이스별 설정은 이 값을 펼친 뒤 `globalSetup`, `moduleNameMapper`, coverage 예외처럼 자기 실행 환경에 필요한 항목만 덧붙인다.
 */
module.exports = {
    testRegex: '(__tests__/.*\\.spec\\.ts)$',
    testEnvironment: 'node',
    resetMocks: true,
    restoreMocks: true,
    resetModules: true,
    // workerIdleMemoryLimit은 일부러 두지 않는다. 워커 재시작이 메모리 누수를 가려버리기 때문이다.
    // maxWorkers가 필요한 무거운 워크스페이스는 각자 Jest 설정에서 직접 지정한다.
    coverageReporters: ['lcov', 'text'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    testTimeout: 60 * 1000
}
