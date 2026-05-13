const path = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const baseConfig = require('../../jest.config.base')

const appDir = __dirname
const tsconfigPath = path.resolve(appDir, 'tsconfig.json')
const tsconfig = require(tsconfigPath)
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })
const { compilerOptions } = tsconfig

module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    globalSetup: path.resolve(__dirname, 'jest.global.js'),
    globalTeardown: path.resolve(__dirname, 'jest.teardown.js'),
    setupFilesAfterEnv: [path.resolve(__dirname, 'jest.setup.js')],
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: appDir,
    roots: ['<rootDir>/src'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    modulePaths: [compilerOptions.baseUrl],
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coveragePathIgnorePatterns: [
        '__tests__',
        // `src` 바로 아래의 `.ts` 파일은 진입점이나 모듈 연결 코드이다.
        // (`development`, `bootstrap`, `app.module`, `project-id` 등.)
        // 커버리지를 따로 잴 의미가 없다.
        '/src/[^/]+\\.ts$',
        '/index\\.ts$',
        '\\.module\\.ts$',
        // Temporal 워크플로 본문은 `bundleWorkflowCode`가 만든 샌드박스
        // 안에서 실행된다. 그 안에서는 Jest의 Istanbul 계측이 닿지 않으므로,
        // 통합 테스트를 실행해도 0%로 기록된다. 순수 로직은 옆 파일로 분리해
        // 단위 테스트로 따로 덮는다.
        '/worker/workflow\\.ts$'
    ],
    coverageDirectory: '<rootDir>/_output/coverage'
}
