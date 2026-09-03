const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const apiRaceDir = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(apiRaceDir, '../..')
const scenarioFiles = fs
    .readdirSync(apiRaceDir)
    .filter((name) => name.endsWith('.js') && name !== 'race-common.js')
    .sort()
const scenarioNames = scenarioFiles.map((name) => path.basename(name, '.js'))

function sortedUnique(values) {
    return [...new Set(values)].sort()
}

test('Stability workflow의 시나리오 목록이 root 파일과 일치한다', () => {
    assert.ok(scenarioNames.length > 0)

    const workflow = fs.readFileSync(
        path.join(workspaceRoot, '.github/workflows/test-stability.yaml'),
        'utf8'
    )
    const workflowNames = [...workflow.matchAll(/tests\/api-race\/runner\.sh ([a-z0-9-]+)/g)].map(
        (match) => match[1]
    )

    assert.deepEqual(sortedUnique(workflowNames), scenarioNames)
})
