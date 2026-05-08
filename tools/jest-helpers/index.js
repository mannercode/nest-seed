const {
    CreateBucketCommand,
    DeleteBucketCommand,
    DeleteObjectsCommand,
    ListBucketsCommand,
    ListObjectsV2Command
} = require('@aws-sdk/client-s3')

const WORKER_DB_PATTERN = /^mongo-w\d+$/
const WORKER_BUCKET_PATTERN = /^s3bucket-w\d+$/

function generateTestId() {
    const chars = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        ''
    )
}

async function cleanCollections(mongoClient, dbName) {
    const db = mongoClient.db(dbName)
    const collections = await db.collections()
    await Promise.all(collections.map((c) => c.deleteMany({})))
}

async function dropMatchingDatabases(mongoClient, pattern) {
    const { databases } = await mongoClient.db().admin().listDatabases()
    const targets = databases.filter((d) => pattern.test(d.name))
    await Promise.all(targets.map((d) => mongoClient.db(d.name).dropDatabase()))
}

async function ensureBucket(s3Client, bucket) {
    try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (err) {
        if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') {
            throw err
        }
    }
}

async function emptyBucket(s3Client, bucket) {
    let continuationToken

    do {
        const listed = await s3Client.send(
            new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken })
        )

        if (listed.Contents?.length) {
            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: bucket,
                    Delete: { Objects: listed.Contents.map((o) => ({ Key: o.Key })) }
                })
            )
        }

        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
    } while (continuationToken)
}

async function dropMatchingBuckets(s3Client, pattern) {
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}))
    const targets = (Buckets ?? []).filter((b) => pattern.test(b.Name))

    for (const bucket of targets) {
        await emptyBucket(s3Client, bucket.Name)
        await s3Client.send(new DeleteBucketCommand({ Bucket: bucket.Name }))
    }
}

/**
 * Per-worker test lifecycle. Each consumer (apps/api, libs/common) supplies
 * connection builders so the env-naming/connection-style differences stay at
 * the call site while the lifecycle (connect → ensure → cleanup → close) is
 * shared. Callable directly from jest.setup.js.
 */
function setupJestLifecycle({
    connectMongo, // (workerId) => Promise<{ client, dbName }>
    createS3Client, // () => S3Client
    bucketName, // (workerId) => string
    afterMongoConnect, // optional: (client) => Promise<void>
    onBeforeEach // optional: (testId) => void | Promise<void>
}) {
    let mongoClient
    let s3Client
    let dbName
    let bucket

    beforeAll(async () => {
        const workerId = process.env.JEST_WORKER_ID ?? '1'

        const m = await connectMongo(workerId)
        mongoClient = m.client
        dbName = m.dbName
        if (afterMongoConnect) await afterMongoConnect(mongoClient)

        s3Client = createS3Client()
        bucket = bucketName(workerId)
        await ensureBucket(s3Client, bucket)

        await Promise.all([
            cleanCollections(mongoClient, dbName),
            emptyBucket(s3Client, bucket)
        ])
    })

    afterAll(async () => {
        await Promise.all([mongoClient.close(), s3Client.destroy()])
    })

    beforeEach(async () => {
        const testId = generateTestId()
        process.env.TEST_ID = testId
        if (onBeforeEach) await onBeforeEach(testId)
    })

    afterEach(async () => {
        await Promise.all([cleanCollections(mongoClient, dbName), emptyBucket(s3Client, bucket)])
    })
}

/**
 * Per-worker leftover cleanup. Run once after the whole jest worker pool
 * exits. Each consumer supplies connection factories (mongo / s3 / redis);
 * `extra` is for additional cleanups specific to one consumer (e.g. libs/common
 * tearing down the in-process Temporal server). Returns the function to
 * export from jest.teardown.js.
 */
function createGlobalTeardown({
    connectMongo, // () => Promise<MongoClient>
    createS3Client, // () => S3Client
    connectRedis, // () => Redis (single or Cluster)
    extra // optional: () => Promise<void>
}) {
    return async function globalTeardown() {
        const tasks = [
            cleanupMongoMatching(connectMongo),
            cleanupS3Matching(createS3Client),
            cleanupRedisAll(connectRedis)
        ]
        if (extra) tasks.push(extra())
        await Promise.all(tasks)
    }
}

async function cleanupMongoMatching(connectMongo) {
    const client = await connectMongo()
    try {
        await dropMatchingDatabases(client, WORKER_DB_PATTERN)
    } finally {
        await client.close()
    }
}

async function cleanupS3Matching(createS3Client) {
    const client = createS3Client()
    try {
        await dropMatchingBuckets(client, WORKER_BUCKET_PATTERN)
    } finally {
        client.destroy()
    }
}

async function cleanupRedisAll(connectRedis) {
    const redis = connectRedis()
    try {
        // ioredis Cluster exposes nodes(role); single connection doesn't.
        if (typeof redis.nodes === 'function') {
            const masters = redis.nodes('master')
            await Promise.all(masters.map((node) => node.flushall()))
        } else {
            await redis.flushall()
        }
    } finally {
        await redis.quit()
    }
}

module.exports = {
    WORKER_BUCKET_PATTERN,
    WORKER_DB_PATTERN,
    cleanCollections,
    createGlobalTeardown,
    dropMatchingBuckets,
    dropMatchingDatabases,
    emptyBucket,
    ensureBucket,
    generateTestId,
    setupJestLifecycle
}
