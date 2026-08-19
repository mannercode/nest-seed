const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
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

test('모든 root JavaScript가 syntax, ESLint, Prettier 정적 검사 대상이다', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(apiRaceDir, 'package.json'), 'utf8'))
    const lintScript = packageJson.scripts?.lint ?? ''

    assert.match(lintScript, /for file in \*\.js __tests__\/\*\.test\.js/)
    assert.match(lintScript, /node --check "\$file"/)
    assert.match(lintScript, /prettier --check ['"]?\*\.js['"]?/)

    const eslintBinary = path.join(workspaceRoot, 'node_modules', '.bin', 'eslint')
    for (const file of ['race-common.js', ...scenarioFiles]) {
        const result = spawnSync(eslintBinary, ['--print-config', file], {
            cwd: apiRaceDir,
            encoding: 'utf8'
        })
        assert.equal(result.status, 0, `${file}: ${result.stderr}`)
        const config = JSON.parse(result.stdout)
        assert.ok(config.rules?.['no-unused-vars'], `${file}: ESLint rules are not configured`)
    }
})

test('runner, Stability workflow, 문서의 시나리오 목록이 root 파일과 일치한다', () => {
    assert.ok(scenarioNames.length > 0)

    const runner = spawnSync('bash', [path.join(apiRaceDir, 'runner.sh')], {
        encoding: 'utf8',
        env: {
            ...process.env,
            ROOT_PASSWORD: 'repository-contract-only',
            WORKSPACE_ROOT: workspaceRoot
        }
    })
    assert.equal(runner.status, 1)
    const runnerNames = [...runner.stdout.matchAll(/^[ ]{2}([a-z0-9-]+)$/gm)].map(
        (match) => match[1]
    )

    const workflow = fs.readFileSync(
        path.join(workspaceRoot, '.github/workflows/test-stability.yaml'),
        'utf8'
    )
    const workflowNames = [...workflow.matchAll(/tests\/api-race\/runner\.sh ([a-z0-9-]+)/g)].map(
        (match) => match[1]
    )

    const docs = fs.readFileSync(path.join(workspaceRoot, 'docs/tests.md'), 'utf8')
    const documentedFiles = [...docs.matchAll(/^\| `([^`]+\.js)`/gm)].map((match) => match[1])
    const documentedNames = documentedFiles
        .filter((file) => scenarioFiles.includes(file))
        .map((file) => path.basename(file, '.js'))

    assert.deepEqual(sortedUnique(runnerNames), scenarioNames)
    assert.deepEqual(sortedUnique(workflowNames), scenarioNames)
    assert.deepEqual(sortedUnique(documentedNames), scenarioNames)
})
