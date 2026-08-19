const { createGlobalTeardown, createJestResourceScope } = require('@mannercode/jest-helpers')

function initializeApiJestWorkerEnvironment(env = process.env) {
    const resourceScope = createJestResourceScope(env.API_JEST_RUN_ID)
    env.TEST_ID = `startup-w${env.JEST_WORKER_ID ?? '1'}`
    env.PROJECT_ID = resourceScope.projectId(env.TEST_ID)
    return resourceScope
}

function createApiJestGlobalTeardown({
    connectMongo,
    connectRedis,
    createS3Client,
    env = process.env
}) {
    const resourceScope = createJestResourceScope(env.API_JEST_RUN_ID)
    return createGlobalTeardown({
        bucketPattern: resourceScope.bucketPattern,
        connectMongo,
        connectRedis,
        createS3Client,
        databasePattern: resourceScope.databasePattern,
        redisKeyPattern: resourceScope.redisKeyPattern,
        redisKeyScope: resourceScope.redisKeyScope
    })
}

module.exports = { createApiJestGlobalTeardown, initializeApiJestWorkerEnvironment }
