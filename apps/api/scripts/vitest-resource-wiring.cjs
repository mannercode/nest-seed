const { createGlobalTeardown, createVitestResourceScope } = require('@mannercode/vitest-helpers')

function initializeApiVitestWorkerEnvironment(env = process.env) {
    const resourceScope = createVitestResourceScope(env.API_VITEST_RUN_ID)
    env.TEST_ID = `startup-w${env.VITEST_POOL_ID ?? '1'}`
    env.PROJECT_ID = resourceScope.projectId(env.TEST_ID)
    return resourceScope
}

function createApiVitestGlobalTeardown({
    connectMongo,
    connectRedis,
    createS3Client,
    env = process.env
}) {
    const resourceScope = createVitestResourceScope(env.API_VITEST_RUN_ID)
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

module.exports = { createApiVitestGlobalTeardown, initializeApiVitestWorkerEnvironment }
