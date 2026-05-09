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
 * 워커별 테스트 lifecycle. 각 소비자 (apps/api, libs/common) 가 connection
 * builder 를 공급하므로 env 네이밍/connection 스타일 차이는 호출부에
 * 남기고 lifecycle (connect → ensure → cleanup → close) 만 공유한다.
 * jest.setup.js 에서 바로 호출 가능.
 */
function setupJestLifecycle({
    connectMongo, // (workerId) => Promise<{ client, dbName }>
    createS3Client, // () => S3Client
    bucketName, // (workerId) => string
    afterMongoConnect, // 선택: (client) => Promise<void>
    onBeforeEach // 선택: (testId) => void | Promise<void>
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
 * 워커별 잔여 cleanup. 전체 jest worker pool 이 종료된 뒤 한 번 실행된다.
 * 각 소비자가 connection factory (mongo / s3 / redis) 를 공급하고, `extra`
 * 는 특정 소비자에 한정된 추가 cleanup (예: libs/common 의 in-process
 * Temporal 서버 종료) 용. jest.teardown.js 에서 export 할 함수를 반환한다.
 */
function createGlobalTeardown({
    connectMongo, // () => Promise<MongoClient>
    createS3Client, // () => S3Client
    connectRedis, // () => Redis (single or Cluster)
    extra // 선택: () => Promise<void>
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
        // ioredis Cluster 는 nodes(role) 을 노출하지만, single connection 은 그렇지 않다.
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
