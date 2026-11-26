const {
    CreateBucketCommand,
    DeleteBucketCommand,
    DeleteObjectsCommand,
    ListBucketsCommand,
    ListObjectsV2Command
} = require('@aws-sdk/client-s3')
const { randomInt } = require('node:crypto')
const { once } = require('node:events')

async function waitForCleanup(operations) {
    const results = await Promise.allSettled(operations)
    const failures = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason)
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'Test resource cleanup failed')
}

function getVitestWorkerId() {
    const id = process.env.VITEST_POOL_ID
    if (!id || !/^[1-9]\d*$/.test(id)) throw new Error('VITEST_POOL_ID must be a positive integer')
    return id
}

function generateTestId() {
    const chars = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('')
}

async function cleanCollections(mongoClient, dbName) {
    const db = mongoClient.db(dbName)
    const collections = await db.collections()
    // 여러 collection을 동시에 비우면 연결 풀이 여러 연결을 한꺼번에 준비해야 한다.
    // 정리 작업은 처리 속도보다 연결 부하를 줄이는 것이 중요하므로 하나씩 비운다.
    for (const collection of collections) {
        await collection.deleteMany({})
    }
}

async function dropMatchingDatabases(mongoClient, pattern) {
    const { databases } = await mongoClient.db().admin().listDatabases()
    const targets = databases.filter((d) => pattern.test(d.name))
    await waitForCleanup(targets.map((d) => mongoClient.db(d.name).dropDatabase()))
}

async function ensureBucket(s3Client, bucket) {
    try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (err) {
        if (err.name !== 'BucketAlreadyOwnedByYou') {
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
            const response = await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: bucket,
                    Delete: { Objects: listed.Contents.map((o) => ({ Key: o.Key })) }
                })
            )
            if (response.Errors?.length) {
                throw new Error(
                    `S3 cleanup failed for bucket ${bucket}: ${JSON.stringify(response.Errors)}`
                )
            }
        }

        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
    } while (continuationToken)
}

async function dropMatchingBuckets(s3Client, pattern) {
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}))
    const targets = (Buckets ?? []).filter((b) => pattern.test(b.Name))

    await waitForCleanup(
        targets.map(async (bucket) => {
            await emptyBucket(s3Client, bucket.Name)
            await s3Client.send(new DeleteBucketCommand({ Bucket: bucket.Name }))
        })
    )
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
 */
function setupVitestLifecycle({
    connectMongo,
    createS3Client,
    bucketName,
    afterMongoConnect,
    onBeforeEach
}) {
    const connections = new AsyncDisposableStack()
    let mongoClient
    let s3Client
    let dbName
    let bucket

    beforeAll(async () => {
        const workerId = getVitestWorkerId()

        const m = await connectMongo(workerId)
        mongoClient = m.client
        connections.defer(() => mongoClient.close())
        dbName = m.dbName
        if (afterMongoConnect) await afterMongoConnect(mongoClient, dbName)

        s3Client = createS3Client()
        connections.defer(() => s3Client.destroy())
        bucket = bucketName(workerId)
        await ensureBucket(s3Client, bucket)

        await waitForCleanup([cleanCollections(mongoClient, dbName), emptyBucket(s3Client, bucket)])
    })

    afterAll(() => connections.disposeAsync())

    beforeEach(async () => {
        const currentTestId = generateTestId()
        process.env.TEST_ID = currentTestId
        if (onBeforeEach) await onBeforeEach(currentTestId)
    })

    afterEach(async () => {
        await waitForCleanup([cleanCollections(mongoClient, dbName), emptyBucket(s3Client, bucket)])
    })
}

/**
 * 워커 풀이 끝난 뒤 해당 워크스페이스의 MongoDB·S3·Redis 자원을 정리한다.
 *
 * @param {object} options
 * @param {() => Promise<MongoClient>} options.connectMongo
 * @param {() => import('@aws-sdk/client-s3').S3Client} options.createS3Client
 * @param {() => import('ioredis').Redis | import('ioredis').Cluster} options.connectRedis
 * @param {RegExp} options.databasePattern
 * @param {RegExp} options.bucketPattern
 * @param {string} options.redisKeyPattern
 * @param {string} options.redisKeyScope
 */
function createGlobalTeardown({
    connectMongo,
    createS3Client,
    connectRedis,
    databasePattern,
    bucketPattern,
    redisKeyPattern,
    redisKeyScope
}) {
    if (!(databasePattern instanceof RegExp) || !(bucketPattern instanceof RegExp)) {
        throw new Error('createGlobalTeardown requires databasePattern and bucketPattern')
    }
    assertScopedRedisKeyPattern(redisKeyPattern, redisKeyScope)

    return async function globalTeardown() {
        await waitForCleanup([
            cleanupMongoMatching(connectMongo, databasePattern),
            cleanupS3Matching(createS3Client, bucketPattern),
            cleanupRedisMatching(connectRedis, redisKeyPattern, redisKeyScope)
        ])
    }
}

async function cleanupMongoMatching(connectMongo, pattern) {
    const client = await connectMongo()
    await using cleanup = new AsyncDisposableStack()
    cleanup.defer(() => client.close())
    await dropMatchingDatabases(client, pattern)
}

async function cleanupS3Matching(createS3Client, pattern) {
    const client = createS3Client()
    await using cleanup = new AsyncDisposableStack()
    cleanup.defer(() => client.destroy())
    await dropMatchingBuckets(client, pattern)
}

async function cleanupRedisMatching(connectRedis, keyPattern, redisKeyScope) {
    assertScopedRedisKeyPattern(keyPattern, redisKeyScope)

    const redis = connectRedis()
    await using cleanup = new AsyncDisposableStack()
    cleanup.defer(() => redis.quit())
    const targets = await redisWriteTargets(redis)
    await waitForCleanup(targets.map((target) => deleteMatchingRedisKeys(target, keyPattern)))
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

async function redisWriteTargets(redis) {
    if (typeof redis.nodes !== 'function') return [redis]

    // Redis Cluster 연결 직후에는 nodes()가 빈 배열을 반환할 수 있다.
    // 삭제할 노드를 하나도 찾지 못한 채 정리를 끝내지 않도록 ready를 기다린다.
    if (redis.status !== 'ready') {
        await once(redis, 'ready')
    }
    const masters = redis.nodes('master')
    if (masters.length === 0) {
        throw new Error('cleanupRedisMatching: no master nodes — cleanup would be a no-op')
    }
    return masters
}

async function deleteMatchingRedisKeys(redis, keyPattern) {
    let cursor = '0'

    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', keyPattern, 'COUNT', '100')
        await waitForCleanup(keys.map((key) => redis.unlink(key)))
        cursor = nextCursor
    } while (cursor !== '0')
}

module.exports = { createGlobalTeardown, getVitestWorkerId, setupVitestLifecycle, waitForCleanup }
