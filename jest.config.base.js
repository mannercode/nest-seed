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
    coverageReporters: ['lcov', 'text'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    testTimeout: 60 * 1000
}
