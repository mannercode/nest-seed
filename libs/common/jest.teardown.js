const { S3Client } = require('@aws-sdk/client-s3')
const {
    WORKER_BUCKET_PATTERN,
    WORKER_DB_PATTERN,
    dropMatchingBuckets,
    dropMatchingDatabases
} = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')
const Redis = require('ioredis')

module.exports = async function globalTeardown() {
    await Promise.all([cleanupMongo(), cleanupS3(), cleanupRedis(), cleanupTemporal()])
}

// jest.global.js 가 globalThis 에 stash 한 TestWorkflowEnvironment 의 ephemeral
// server child process 를 명시 종료. 안 부르면 jest 가 끝난 뒤 orphan 가능.
async function cleanupTemporal() {
    const env = globalThis.__TEMPORAL_TEST_ENV__
    if (!env) return
    await env.teardown()
}

async function cleanupMongo() {
    const client = new MongoClient(process.env.TESTLIB_MONGO_URI)
    await client.connect()

    try {
        await dropMatchingDatabases(client, WORKER_DB_PATTERN)
    } finally {
        await client.close()
    }
}

async function cleanupS3() {
    const client = new S3Client({
        endpoint: process.env.TESTLIB_S3_ENDPOINT,
        region: 'us-east-1',
        credentials: {
            accessKeyId: process.env.TESTLIB_S3_ACCESS_KEY,
            secretAccessKey: process.env.TESTLIB_S3_SECRET_KEY
        },
        forcePathStyle: true
    })

    try {
        await dropMatchingBuckets(client, WORKER_BUCKET_PATTERN)
    } finally {
        client.destroy()
    }
}

async function cleanupRedis() {
    const redis = new Redis(process.env.TESTLIB_REDIS_URL)

    try {
        await redis.flushall()
    } finally {
        await redis.quit()
    }
}
