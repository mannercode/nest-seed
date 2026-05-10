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
    // 풀스택으로 부팅하므로 워커 1 개만 떠도 RSS + 컨테이너 메모리가 무거워
    // 16GB ARM 러너의 천장에 가깝다. 워커 2 개로 줄여도 booking·showtimes
    // spec 이 jest 자동 retry 에서도 같은 자리에서 OOM 했고 (단일 testFile
    // 부팅이 임계를 넘김), 격리(매 fixture 부트) 는 의도이므로 공유로
    // 풀지 않는다 — 워커를 1 로 직렬화해 다른 워커/컨테이너 부하 없이
    // 단독 메모리를 쓰게 한다.
    maxWorkers: 1,
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
