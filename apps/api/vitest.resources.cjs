const scope = 'nest-seed-api-test'

module.exports = {
    bucketName: (workerId) => `s3bucket-api-w${workerId}`,
    databaseName: (workerId) => `mongo-api-w${workerId}`,
    projectId: (testId) => `project-${scope}-${testId}`,
    cleanup: {
        demoSubject: /^project-nest-seed-api-test-[A-Za-z0-9_-]+\.event-demo\.queued$/,
        bucketPattern: /^s3bucket-api-w\d+$/,
        databasePattern: /^mongo-api-w\d+$/,
        redisKeyPattern: `*project-${scope}-*`,
        redisKeyScope: scope
    }
}
