const path = require('node:path')
// Vite config bundling에서도 pnpm workspace package 이름을 CJS require 대상으로 보존한다.
const vitestHelpersPackage = '@mannercode/vitest-helpers'
const { createVitestResourceRunId, createVitestResourceScope } = require(vitestHelpersPackage)

function initializeApiVitestRun(appDir, env = process.env) {
    const runId = createVitestResourceRunId()
    env.API_VITEST_RUN_ID = runId

    const context = buildApiVitestRunContext(appDir, runId)
    env.API_VITEST_OUTPUT_DIRECTORY = context.outputDirectory
    return context
}

function readApiVitestRun(appDir, env = process.env) {
    const runId = env.API_VITEST_RUN_ID
    createVitestResourceScope(runId)

    const context = buildApiVitestRunContext(appDir, runId)
    assertEnvironmentPath(env, 'API_VITEST_OUTPUT_DIRECTORY', context.outputDirectory)
    return context
}

function buildApiVitestRunContext(appDir, runId) {
    const outputDirectory = path.resolve(appDir, '_output/vitest-runs', `r${runId}`)
    return { coverageDirectory: path.join(outputDirectory, 'coverage'), outputDirectory, runId }
}

function assertEnvironmentPath(env, name, expected) {
    if (env[name] !== expected) {
        throw new Error(`${name} must match the current API Vitest run directory`)
    }
}

module.exports = { initializeApiVitestRun, readApiVitestRun }
