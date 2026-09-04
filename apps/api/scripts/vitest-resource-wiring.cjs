const { createGlobalTeardown } = require('@mannercode/vitest-helpers')

const RESOURCE_SCOPE = 'nest-seed-api-test'
const resourceScope = {
    bucketName: (workerId) => `s3bucket-api-w${workerId}`,
    bucketPattern: /^s3bucket-api-w\d+$/,
    databaseName: (workerId) => `mongo-api-w${workerId}`,
    databasePattern: /^mongo-api-w\d+$/,
    projectId: (testId) => `project-${RESOURCE_SCOPE}-${testId}`,
    redisKeyPattern: `*project-${RESOURCE_SCOPE}-*`,
    redisKeyScope: RESOURCE_SCOPE
}

function initializeApiVitestWorkerEnvironment(env = process.env) {
    env.TEST_ID = `startup-w${env.VITEST_POOL_ID ?? '1'}`
    env.PROJECT_ID = resourceScope.projectId(env.TEST_ID)
    return resourceScope
}

function createApiVitestGlobalTeardown({ connectMongo, connectRedis, createS3Client }) {
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
