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
        // src 바로 아래의 .ts 는 진입점/와이어링 (development, production,
        // bootstrap-app, app.module, global.module, errors, project-id 등) 이라
        // 커버리지 측정 의미가 없다.
        '/src/[^/]+\\.ts$',
        '/index\\.ts$',
        '\\.module\\.ts$',
        // Temporal 워크플로 본문은 `bundleWorkflowCode` 의 격리된 가상머신 안에서
        // 실행되므로 jest 의 istanbul 계측이 실행 흐름을 볼 수 없다.
        // showtime-creation.spec.ts 가 종단 간으로 실행해도 마찬가지다. 순수 로직
        // (extractRootMessage 등) 은 옆 파일에 있고 단위 테스트로 덮인다.
        '/temporal/workflows\\.ts$'
    ],
    coverageDirectory: '<rootDir>/_output/coverage'
}
