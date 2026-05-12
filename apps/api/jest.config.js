const path = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')
const baseConfig = require('../../jest.config.base')

const appDir = __dirname
const tsconfigPath = path.resolve(appDir, 'tsconfig.json')
const tsconfig = require(tsconfigPath)
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })
const { compilerOptions } = tsconfig
const maxWorkers = process.env.JEST_MAX_WORKERS ?? 2
const workerIdleMemoryLimit = process.env.JEST_WORKER_IDLE_MEMORY_LIMIT ?? '1500MB'

module.exports = {
    ...baseConfig,
    ...tsJestPreset,
    // API 통합 테스트는 워커마다 Nest AppModule, Temporal worker, DB/NATS/S3
    // 연결과 coverage 계측을 함께 올립니다. 기본값(코어 수 - 1)은 이 환경에서
    // 15개 워커를 띄워 총 RSS를 크게 키우므로, 기본 병렬도를 보수적으로 둡니다.
    // 여유 있는 머신에서는 `JEST_MAX_WORKERS=4 npm test`처럼 올릴 수 있습니다.
    maxWorkers,
    // 긴 실행에서 한 워커가 여러 통합 테스트를 처리하며 쌓는 heap/RSS는
    // 누수 진단을 가리지 않는 선에서 재시작합니다. 루트 설정의 1MB처럼 모든
    // 테스트 파일마다 워커를 갈아치우는 값은 피하고, API 스위트에만 둡니다.
    workerIdleMemoryLimit,
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
        // `src` 바로 아래의 `.ts` 파일은 진입점이나 모듈 wiring입니다.
        // (`development`, `bootstrap`, `app.module`, `project-id` 등.)
        // 커버리지를 따로 잴 의미가 없습니다.
        '/src/[^/]+\\.ts$',
        '/index\\.ts$',
        '\\.module\\.ts$',
        // Temporal 워크플로우 본문은 `bundleWorkflowCode`가 만든 샌드박스
        // 안에서 실행됩니다. 그 안에서는 Jest의 istanbul 계측이 닿지 않으므로,
        // 통합 테스트를 실행해도 0%로 기록됩니다. 순수 로직은 옆 파일로 분리해
        // 단위 테스트로 따로 덮습니다.
        '/worker/workflow\\.ts$'
    ],
    coverageDirectory: '<rootDir>/_output/coverage'
}
