/**
 * Shared defaults for all workspace jest configs. A concrete config
 * (libs/jest.config.js, apis/jest.config.js) layers its globalSetup,
 * moduleNameMapper, and coverage rules on top of this.
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
