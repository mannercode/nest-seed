const path = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const baseConfig = require('../../jest.config.base')
const { initializeApiJestRun } = require('./scripts/jest-run-context')

const appDir = __dirname
const jestRun = initializeApiJestRun(appDir)
const tsconfig = require(path.resolve(appDir, 'tsconfig.json'))
const tsJestPreset = createDefaultPreset({ tsconfig: path.resolve(appDir, 'tsconfig.jest.json') })
const { compilerOptions } = tsconfig

module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    globalSetup: path.resolve(__dirname, 'jest.global.js'),
    globalTeardown: path.resolve(__dirname, 'jest.teardown.js'),
    reporters: ['default', path.resolve(__dirname, 'scripts/jest-failure-diagnostics-reporter.js')],
    setupFilesAfterEnv: [path.resolve(__dirname, 'jest.setup.js')],
    roots: ['<rootDir>/src'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coveragePathIgnorePatterns: [
        '__tests__',
        // 프로세스 진입점·HTTP bootstrap·루트 DI 조립은 단위 coverage에서 제외한다.
        // AppModule 동작은 통합 테스트가, 실제 기동 경로는 deploy 검증과 stability bootup이 확인한다.
        '/src/[^/]+\\.ts$',
        // barrel과 Nest 모듈은 export·프레임워크 조립 경계라 coverage 수집 대상에서 제외한다.
        // 모듈 조립은 앱 통합 테스트로, 업무 로직은 각 구현 파일의 coverage로 검증한다.
        '/index\\.ts$',
        '\\.module\\.ts$'
    ],
    coverageDirectory: jestRun.coverageDirectory
}
