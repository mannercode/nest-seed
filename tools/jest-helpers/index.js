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
 * 각 Jest 워커가 Mongo, S3 fixture를 준비하고 정리하는 공통 흐름입니다.
 * 워크스페이스마다 환경 변수 이름과 연결 방식이 다르므로, 연결 생성 함수는
 * 호출부가 넘기고 이 helper는 순서(connect → ensure → cleanup → close)만
 * 책임집니다.
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
 * 전체 Jest worker pool이 종료된 뒤 한 번 실행되는 공통 정리 함수입니다.
 * 각 워크스페이스가 Mongo/S3/Redis 연결 생성 함수를 넘기고, `extra`에는
 * 해당 워크스페이스에만 필요한 정리 작업(예: in-process Temporal 서버 종료)을
 * 넣습니다.
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
        // ioredis Cluster와 단일 연결은 flush 방법이 달라 런타임에 구분합니다.
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
