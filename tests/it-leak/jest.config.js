// it block 단위 측정. apps/api spec 과 tests/it-leak 의 자체 spec 모두
// 매칭하도록 fixture-leak/jest.config.js 와 같은 패턴으로 풀 config 작성.
const path = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')

const apiDir = path.resolve(__dirname, '../../apps/api')
const wsRoot = path.resolve(__dirname, '../..')
const tsconfigPath = path.resolve(apiDir, 'tsconfig.json')
const tsconfig = require(tsconfigPath)
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })
const { compilerOptions } = tsconfig

module.exports = {
    ...tsJestPreset,
    testEnvironment: 'node',
    // 환경변수로 resetModules 토글. 누수 검증용.
    //   bash run.sh ...                       → true (apps/api 와 동일)
    //   RESET_MODULES=false bash run.sh ...   → false (가설 검증)
    resetModules: process.env.RESET_MODULES !== 'false',
    resetMocks: true,
    restoreMocks: true,
    testTimeout: 60 * 1000,
    testRegex: '\\.spec\\.ts$',
    rootDir: wsRoot,
    roots: [path.resolve(apiDir, 'src'), __dirname],
    moduleFileExtensions: ['js', 'json', 'ts'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
        prefix: apiDir + '/'
    }),
    modulePaths: [path.resolve(apiDir, compilerOptions.baseUrl)],
    globalSetup: path.resolve(apiDir, 'jest.global.js'),
    globalTeardown: path.resolve(apiDir, 'jest.teardown.js'),
    setupFilesAfterEnv: [
        path.resolve(apiDir, 'jest.setup.js'),
        path.resolve(__dirname, 'jest.setup.js')
    ]
}
