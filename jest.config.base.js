/**
 * 모든 워크스페이스의 jest 설정이 공유하는 기본값이다. 각 워크스페이스의
 * jest 설정이 이 위에 `globalSetup`, `moduleNameMapper`, coverage 규칙
 * 같은 항목을 덧붙인다.
 */
module.exports = {
    testRegex: '(__tests__/.*\\.spec\\.ts)$',
    testEnvironment: 'node',
    resetMocks: true,
    restoreMocks: true,
    resetModules: true,
    // `resetModules: true` 가 워커마다 모듈 그래프를 새로 만들면서 메모리를
    // 야금야금 점유한다. 일정량을 넘으면 워커를 비워서 누수를 막는다.
    workerIdleMemoryLimit: '1MB',
    coverageReporters: ['lcov', 'text'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    testTimeout: 60 * 1000
}
