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
        'npm run lint && npm run test:api-docs-redaction && npm run test:jest-isolation && npm test'
    )
})

test('API stability 반복은 run별 coverage 산출물을 만들지 않는다', () => {
    const workflow = fs.readFileSync(
        path.join(workspaceRoot, '.github/workflows/test-stability.yaml'),
        'utf8'
    )
    const apiRepeatCommands = workflow
        .split('\n')
        .filter((line) => line.includes('repeat.sh 20 npm test -w apps/api'))

    assert.equal(apiRepeatCommands.length, 3)
    for (const command of apiRepeatCommands) {
        assert.match(command, /--coverage=false(?:\s|$)/)
    }
})
