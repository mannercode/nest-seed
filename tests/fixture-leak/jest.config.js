// apps/api 의 jest 설정을 그대로 빌려오되 rootDir/testRegex 만 이 디렉터리로
// 바꾼다. apps/api 의 path alias (core, config, @mannercode/...) 와 setup
// (jest.global.js, jest.setup.js) 을 그대로 재사용해야 createAppTestContext
// 가 정상 부팅된다.
const path = require('path')
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')

const apiDir = path.resolve(__dirname, '../../apps/api')
const tsconfigPath = path.resolve(apiDir, 'tsconfig.json')
const tsconfig = require(tsconfigPath)
const tsJestPreset = createDefaultPreset({ tsconfig: tsconfigPath })
const { compilerOptions } = tsconfig

module.exports = {
    ...tsJestPreset,
    testEnvironment: 'node',
    resetModules: true,
    resetMocks: true,
    restoreMocks: true,
    testTimeout: 60 * 1000,
    testRegex: '\\.spec\\.ts$',
    rootDir: __dirname,
    roots: [__dirname],
    moduleFileExtensions: ['js', 'json', 'ts'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
        prefix: apiDir + '/'
    }),
    modulePaths: [path.resolve(apiDir, compilerOptions.baseUrl)],
    globalSetup: path.resolve(apiDir, 'jest.global.js'),
    globalTeardown: path.resolve(apiDir, 'jest.teardown.js'),
    setupFilesAfterEnv: [path.resolve(apiDir, 'jest.setup.js')]
}
