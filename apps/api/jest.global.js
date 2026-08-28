const fs = require('fs')
const { readApiJestRun } = require('./scripts/jest-run-context')

module.exports = async function globalSetup() {
    // config에서 만든 ID와 출력 경로를 worker·teardown·bundle 자식 프로세스가 함께 상속한다.
    // coverage 경로도 config 시점에 정해야 하므로 globalSetup에서 ID를 다시 만들면 안 된다.
    const jestRun = readApiJestRun(__dirname)
    fs.mkdirSync(jestRun.logDirectory, { recursive: true })
}
