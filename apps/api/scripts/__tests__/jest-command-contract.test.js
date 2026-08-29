const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const apiDirectory = path.resolve(__dirname, '../..')
const workspaceRoot = path.resolve(apiDirectory, '../..')

test('병렬 invocation fixture는 실제 API setup과 teardown을 사용한다', () => {
    const fixtureConfig = require('./fixtures/jest-invocation/jest.config')

    assert.deepEqual(fixtureConfig.setupFilesAfterEnv, [path.join(apiDirectory, 'jest.setup.js')])
    assert.equal(fixtureConfig.globalTeardown, path.join(apiDirectory, 'jest.teardown.js'))
})

test('API의 일반 test는 Jest만 실행하고 atoz가 isolation harness를 한 번 gate한다', () => {
    const { scripts } = require(path.join(apiDirectory, 'package.json'))

    assert.doesNotMatch(scripts.test, /test:jest-isolation/)
    assert.match(scripts.test, /jest --coverage/)
    assert.equal(
        scripts.atoz,
        'pnpm run lint && pnpm run test:api-docs-redaction && pnpm run test:jest-isolation && pnpm test'
    )
})

test('API stability 반복은 run별 coverage 산출물을 만들지 않는다', () => {
    const workflow = fs.readFileSync(
        path.join(workspaceRoot, '.github/workflows/test-stability.yaml'),
        'utf8'
    )
    const apiRepeatCommands = workflow
        .split('\n')
        .filter((line) =>
            line.includes("repeat.sh 20 pnpm --filter './apps/api' --fail-if-no-match run test")
        )

    assert.equal(apiRepeatCommands.length, 3)
    for (const command of apiRepeatCommands) {
        assert.match(command, /--coverage=false(?:\s|$)/)
    }
})

test('API integration spec은 setup 실패 뒤 이전 fixture를 다시 닫지 않는다', () => {
    const specs = fs.globSync('src/__tests__/**/*.spec.ts', { cwd: apiDirectory })

    for (const spec of specs) {
        const source = fs.readFileSync(path.join(apiDirectory, spec), 'utf8')
        assert.doesNotMatch(source, /afterEach\(\(\) => fix\.teardown\(\)\)/, spec)
    }
})
