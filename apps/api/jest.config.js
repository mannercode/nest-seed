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
    // 통합 spec 은 매 it (beforeEach) 마다 createAppTestContext 로 AppModule 을
    // 통째 부팅한다. resetModules:true (격리는 의도) 는 모듈을 매 it fresh
    // evaluate 시키는데, 이전 evaluate 의 NestJS 클래스 instance 가 어딘가
    // strong ref (reflect-metadata global Map / mongoose connections 등) 로
    // 잡혀 GC 되지 못하고 native buffer (BSON/arrayBuffer) 가 it 당 ~16MB
    // 누적된다. 통합 spec 3 개만 돌아도 V8 heap 천장(~2.6GB)에 닿아 OOM.
    // 격리 의도와 framework 누적의 trade-off 는 후속 작업으로 미루고, 여기서는
    // 워커 RSS 가 1.5GB 도달하면 jest 가 워커를 회수(새 워커 fork)해 누적을
    // 끊는다. 1 GB 는 baseline 직후라 너무 잦은 회수, 2 GB 는 V8 heap 천장에
    // 너무 가까워 OOM 위험.
    workerIdleMemoryLimit: '10MB',
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
