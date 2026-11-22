const scope = 'nest-seed-api-test'

module.exports = {
    bucketName: (workerId) => `s3bucket-api-w${workerId}`,
    databaseName: (workerId) => `mongo-api-w${workerId}`,
    projectId: (testId) => `project-${scope}-${testId}`,
    cleanup: {
        bucketPattern: /^s3bucket-api-w\d+$/,
        databasePattern: /^mongo-api-w\d+$/,
        redisKeyPattern: `*project-${scope}-*`,
        redisKeyScope: scope
    }
}
