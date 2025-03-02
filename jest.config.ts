import type { Config } from 'jest'

const config: Config = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '.*\\.spec\\.(ts|js)$',
    testEnvironment: 'node',
    transform: { '^.+\\.ts$': 'ts-jest' },
    // 테스트 간 격리를 위해 모의 함수/모듈 상태를 완전히 초기화
    clearMocks: true, // 각 테스트 후 mock 호출 기록 제거
    resetMocks: true, // 각 테스트 후 mock 구현 초기화
    restoreMocks: true, // 각 테스트 후 원본 구현 복원(spyOn)
    resetModules: true, // 모듈 캐시 리셋(테스트 간 모듈 상태 격리)
    rootDir: '.',
    roots: ['<rootDir>/src'],
    moduleNameMapper: {
        '^common$': '<rootDir>/src/libs/common/index',
        '^testlib$': '<rootDir>/src/libs/testlib/index',
        '^shared/(.*)$': '<rootDir>/src/apps/shared/$1',
        '^gateway$': '<rootDir>/src/apps/gateway/index',
        '^applications$': '<rootDir>/src/apps/applications/index',
        '^cores$': '<rootDir>/src/apps/cores/index',
        '^infrastructures$': '<rootDir>/src/apps/infrastructures/index'
    },
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: [
        '__tests__',
        '\\.controller\\.ts$',
        '/production\\.ts$',
        '/development\\.ts$',
        '/main\\.ts$',
        '/modules/',
        '/index\\.ts$',
        '\\.module\\.ts$',
        '/libs/testlib/',
    ],
    coverageDirectory: '<rootDir>/_output/coverage',
    testTimeout: 10000
}

export default config
