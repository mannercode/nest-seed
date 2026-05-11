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
    // 워커 재시작은 누수를 숨기기 쉬우므로, 무거운 워크스페이스는 각 Jest 설정에서
    // maxWorkers와 현실적인 workerIdleMemoryLimit을 따로 둡니다.
    // workerIdleMemoryLimit: '1MB',
    coverageReporters: ['lcov', 'text'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    testTimeout: 60 * 1000
}
