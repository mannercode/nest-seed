const path = require('node:path')
const { createJestResourceRunId, createJestResourceScope } = require('@mannercode/jest-helpers')

function initializeApiJestRun(appDir, env = process.env) {
    const runId = createJestResourceRunId()
    env.API_JEST_RUN_ID = runId

    const context = buildApiJestRunContext(appDir, runId)
    env.API_JEST_OUTPUT_DIRECTORY = context.outputDirectory
    env.API_JEST_WORKFLOW_DIRECTORY = context.workflowDirectory
    env.LOG_DIRECTORY = context.logDirectory
    return context
}

function readApiJestRun(appDir, env = process.env) {
    const runId = env.API_JEST_RUN_ID
    createJestResourceScope(runId)

    const context = buildApiJestRunContext(appDir, runId)
    assertEnvironmentPath(env, 'API_JEST_OUTPUT_DIRECTORY', context.outputDirectory)
    assertEnvironmentPath(env, 'API_JEST_WORKFLOW_DIRECTORY', context.workflowDirectory)
    assertEnvironmentPath(env, 'LOG_DIRECTORY', context.logDirectory)
    return context
}

function buildApiJestRunContext(appDir, runId) {
    const outputDirectory = path.resolve(appDir, '_output/jest-runs', `r${runId}`)
    return {
        coverageDirectory: path.join(outputDirectory, 'coverage'),
        logDirectory: path.join(outputDirectory, 'logs'),
        outputDirectory,
        runId,
        workflowDirectory: path.join(outputDirectory, 'workflows')
    }
}

function assertEnvironmentPath(env, name, expected) {
    if (env[name] !== expected) {
        throw new Error(`${name} must match the current API Jest run directory`)
    }
}

module.exports = { initializeApiJestRun, readApiJestRun }
