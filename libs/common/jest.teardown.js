const { S3Client } = require('@aws-sdk/client-s3')
const { createGlobalTeardown } = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')
const Redis = require('ioredis')

module.exports = createGlobalTeardown({
    connectMongo: async () => {
        const client = new MongoClient(process.env.TESTLIB_MONGO_URI)
        await client.connect()
        return client
    },
    createS3Client: () =>
        new S3Client({
            endpoint: process.env.TESTLIB_S3_ENDPOINT,
            region: 'us-east-1',
            credentials: {
                accessKeyId: process.env.TESTLIB_S3_ACCESS_KEY,
                secretAccessKey: process.env.TESTLIB_S3_SECRET_KEY
            },
            forcePathStyle: true
        }),
    connectRedis: () => new Redis(process.env.TESTLIB_REDIS_URL),
    // jest.global.js stashes the TestWorkflowEnvironment on globalThis;
    // explicit teardown() ends its child process so jest can exit cleanly.
    extra: async () => {
        const env = globalThis.__TEMPORAL_TEST_ENV__
        if (env) await env.teardown()
    }
})
