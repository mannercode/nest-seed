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
    // 통합 테스트마다 fixture 가 NestJS + Mongo + Redis + Temporal + NATS 를
    // 풀스택으로 부팅하므로 워커당 메모리 점유가 크다. 16GB ARM 러너에서
    // 기본값(cpus-1) 으로 돌리면 동시 부팅 부하로 OOM·Mongo 풀 타임아웃·gRPC
    // deadline 이 줄줄이 터진다. 격리(매 fixture 부트) 는 의도이고 공유로
    // 풀지 않는다 — 동시 실행수만 줄여서 피크 메모리를 낮춘다.
    maxWorkers: 2,
    collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
    coveragePathIgnorePatterns: [
        '__tests__',
        // src 바로 아래의 .ts 는 진입점/와이어링 (development, production,
        // bootstrap, app.module, global.module, errors, project-id 등) 이라
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
