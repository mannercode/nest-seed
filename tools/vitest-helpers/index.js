const {
    CreateBucketCommand,
    DeleteBucketCommand,
    DeleteObjectsCommand,
    ListBucketsCommand,
    ListObjectsV2Command
} = require('@aws-sdk/client-s3')
const { randomInt } = require('node:crypto')

const WORKER_DB_PATTERN = /^mongo-w\d+$/
const WORKER_BUCKET_PATTERN = /^s3bucket-w\d+$/
function generateTestId() {
    const chars = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('')
}

async function cleanCollections(mongoClient, dbName) {
    const db = mongoClient.db(dbName)
    const collections = await db.collections()
    // 정리는 테스트 본문과 달리 처리량을 얻을 이유가 없다. 한 worker의 모든 collection을
    // 동시에 비우면 짧은 수명의 pool이 connection을 만드는 동안 불필요한 checkout
    // fan-out이 생긴다. 순차 실행해 정리 작업이 항상 connection 하나만 사용하게 한다.
    for (const collection of collections) {
        await collection.deleteMany({})
    }
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

/** @typedef {import('mongodb').MongoClient} MongoClient */
/** @typedef {{client: MongoClient, dbName: string}} WorkerMongoConnection */

/**
 * 연결 생성은 호출부에 맡기고 Vitest 워커별 Mongo/S3 준비·정리 순서만 공통화한다.
 *
 * @param {object} options
 * @param {(workerId: string) => Promise<WorkerMongoConnection>} options.connectMongo
 * @param {() => import('@aws-sdk/client-s3').S3Client} options.createS3Client
 * @param {(workerId: string) => string} options.bucketName
 * @param {(client: MongoClient, dbName: string) => void | Promise<void>} [options.afterMongoConnect]
 * @param {(testId: string) => void | Promise<void>} [options.onBeforeEach]
 * @param {(testId: string) => void | Promise<void>} [options.onAfterEach]
 */
function setupVitestLifecycle({
    connectMongo,
    createS3Client,
    bucketName,
    afterMongoConnect,
    onBeforeEach,
    onAfterEach
}) {
    let mongoClient
    let s3Client
    let dbName
    let bucket
    let currentTestId

    beforeAll(async () => {
        const workerId = process.env.VITEST_POOL_ID ?? '1'

        const m = await connectMongo(workerId)
        mongoClient = m.client
        dbName = m.dbName
        if (afterMongoConnect) await afterMongoConnect(mongoClient, dbName)

        s3Client = createS3Client()
        bucket = bucketName(workerId)
        await ensureBucket(s3Client, bucket)

        await Promise.all([cleanCollections(mongoClient, dbName), emptyBucket(s3Client, bucket)])
    })

    afterAll(async () => {
        // beforeAll이 중간에 실패하면 일부 핸들이 비어 있다.
        // undefined에 close를 호출해 TypeError로 원인(beforeAll 실패)을 가리지 않게 한다.
        await Promise.all([mongoClient?.close(), s3Client?.destroy()])
    })

    beforeEach(async () => {
        currentTestId = generateTestId()
        process.env.TEST_ID = currentTestId
        if (onBeforeEach) await onBeforeEach(currentTestId)
    })

    afterEach(async () => {
        const tasks = [cleanCollections(mongoClient, dbName), emptyBucket(s3Client, bucket)]
        if (onAfterEach) tasks.push(onAfterEach(currentTestId))
        await Promise.all(tasks)
    })
}

/**
 * 워커 풀이 끝난 뒤 공용 인프라와 워크스페이스별 추가 자원을 함께 정리한다.
 *
 * @param {object} options
 * @param {boolean} [options.allowRedisFlushAll=false]
 * @param {() => Promise<MongoClient>} options.connectMongo
 * @param {() => import('@aws-sdk/client-s3').S3Client} options.createS3Client
 * @param {() => import('ioredis').Redis | import('ioredis').Cluster} options.connectRedis
 * @param {RegExp} [options.databasePattern]
 * @param {RegExp} [options.bucketPattern]
 * @param {string} [options.redisKeyPattern]
 * @param {string} [options.redisKeyScope]
 * @param {() => Promise<void>} [options.extra]
 */
function createGlobalTeardown({
    allowRedisFlushAll = false,
    connectMongo,
    createS3Client,
    connectRedis,
    databasePattern = WORKER_DB_PATTERN,
    bucketPattern = WORKER_BUCKET_PATTERN,
    redisKeyPattern,
    redisKeyScope,
    extra
}) {
    if (redisKeyPattern !== undefined && allowRedisFlushAll) {
        throw new Error(
            'createGlobalTeardown must not combine redisKeyPattern and allowRedisFlushAll'
        )
    }
    if (redisKeyPattern === undefined && !allowRedisFlushAll) {
        throw new Error(
            'createGlobalTeardown requires redisKeyPattern or explicit allowRedisFlushAll: true'
        )
    }
    if (redisKeyPattern !== undefined) {
        assertScopedRedisKeyPattern(redisKeyPattern, redisKeyScope)
    }

    return async function globalTeardown() {
        const tasks = [
            cleanupMongoMatching(connectMongo, databasePattern),
            cleanupS3Matching(createS3Client, bucketPattern),
            redisKeyPattern === undefined
                ? cleanupRedisAll(connectRedis)
                : cleanupRedisMatching(connectRedis, redisKeyPattern, redisKeyScope)
        ]
        if (extra) tasks.push(extra())
        await Promise.all(tasks)
    }
}

async function cleanupMongoMatching(connectMongo, pattern = WORKER_DB_PATTERN) {
    const client = await connectMongo()
    try {
        await dropMatchingDatabases(client, pattern)
    } finally {
        await client.close()
    }
}

async function cleanupS3Matching(createS3Client, pattern = WORKER_BUCKET_PATTERN) {
    const client = createS3Client()
    try {
        await dropMatchingBuckets(client, pattern)
    } finally {
        client.destroy()
    }
}

async function cleanupRedisAll(connectRedis) {
    const redis = connectRedis()
    try {
        const targets = await redisWriteTargets(redis, 'cleanupRedisAll')
        await Promise.all(targets.map((target) => target.flushall()))
    } finally {
        await redis.quit()
    }
}

async function cleanupRedisMatching(connectRedis, keyPattern, redisKeyScope) {
    assertScopedRedisKeyPattern(keyPattern, redisKeyScope)

    const redis = connectRedis()
    try {
        const targets = await redisWriteTargets(redis, 'cleanupRedisMatching')
        await Promise.all(targets.map((target) => deleteMatchingRedisKeys(target, keyPattern)))
    } finally {
        await redis.quit()
    }
}

function assertScopedRedisKeyPattern(keyPattern, redisKeyScope) {
    if (typeof keyPattern !== 'string' || keyPattern.trim().length === 0) {
        throw new Error('cleanupRedisMatching requires a scoped Redis key pattern')
    }

    if (
        typeof redisKeyScope !== 'string' ||
        !/^[A-Za-z0-9_-]{16,}$/.test(redisKeyScope) ||
        !/^\*?[A-Za-z0-9:._/-]+\*?$/.test(keyPattern) ||
        !keyPattern.includes(redisKeyScope)
    ) {
        throw new Error(
            'cleanupRedisMatching requires redisKeyScope (16+ safe literal characters) in key pattern'
        )
    }
}

async function redisWriteTargets(redis, operation) {
    if (typeof redis.nodes !== 'function') return [redis]

    // Cluster의 connectionPool은 비동기로 채워져, 생성 직후의 nodes()는 빈 배열이다.
    // 그대로 진행하면 정리가 조용히 no-op이 되므로 ready를 기다린 뒤 조회한다.
    if (redis.status !== 'ready') {
        await new Promise((resolve, reject) => {
            redis.once('ready', resolve)
            redis.once('error', reject)
        })
    }
    const masters = redis.nodes('master')
    if (masters.length === 0) {
        throw new Error(`${operation}: no master nodes — cleanup would be a no-op`)
    }
    return masters
}

async function deleteMatchingRedisKeys(redis, keyPattern) {
    let cursor = '0'

    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', keyPattern, 'COUNT', '100')
        await Promise.all(keys.map((key) => redis.unlink(key)))
        cursor = nextCursor
    } while (cursor !== '0')
}

module.exports = {
    WORKER_BUCKET_PATTERN,
    WORKER_DB_PATTERN,
    cleanCollections,
    cleanupRedisMatching,
    createGlobalTeardown,
    dropMatchingBuckets,
    dropMatchingDatabases,
    emptyBucket,
    ensureBucket,
    generateTestId,
    setupVitestLifecycle
}
