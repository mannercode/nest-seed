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
    // jest.global.js 가 TestWorkflowEnvironment 를 globalThis 에 보관해둔다.
    // 명시적 teardown() 으로 child process 를 종료해 jest 가 깔끔히 빠지도록 한다.
    extra: async () => {
        const env = globalThis.__TEMPORAL_TEST_ENV__
        if (env) await env.teardown()
    }
})
