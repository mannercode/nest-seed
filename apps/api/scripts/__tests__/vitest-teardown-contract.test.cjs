const assert = require('node:assert/strict')
const {
    DeleteBucketCommand,
    ListBucketsCommand,
    ListObjectsV2Command
} = require('@aws-sdk/client-s3')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const { createVitestResourceScope } = require('@mannercode/vitest-helpers')

const RUN_A = '0123456789abcdef0123456789abcdef'
const RUN_B = 'fedcba9876543210fedcba9876543210'
const teardownPath = path.resolve(__dirname, '../../vitest.teardown.cjs')

test('actual vitest.teardown은 현재 run의 Mongo, S3, Redis sentinel만 선택한다', async () => {
    const first = createVitestResourceScope(RUN_A)
    const second = createVitestResourceScope(RUN_B)
    const ownDatabase = first.databaseName('1')
    const otherDatabase = second.databaseName('1')
    const ownBucket = first.bucketName('1')
    const otherBucket = second.bucketName('1')
    const ownRedisKey = `cache:${first.projectId('one')}:value`
    const otherRedisKey = `cache:${second.projectId('one')}:value`
    const droppedDatabases = []
    const deletedBuckets = []
    const deletedRedisKeys = []

    class FakeMongoClient {
        async close() {}
        async connect() {}
        db(name) {
            if (name === undefined) {
                return {
                    admin: () => ({
                        listDatabases: async () => ({
                            databases: [{ name: ownDatabase }, { name: otherDatabase }]
                        })
                    })
                }
            }
            return { dropDatabase: async () => droppedDatabases.push(name) }
        }
    }
    class FakeS3Client {
        destroy() {}
        async send(command) {
            if (command instanceof ListBucketsCommand) {
                return { Buckets: [{ Name: ownBucket }, { Name: otherBucket }] }
            }
            if (command instanceof ListObjectsV2Command) return { Contents: [] }
            if (command instanceof DeleteBucketCommand) {
                deletedBuckets.push(command.input.Bucket)
                return {}
            }
            throw new Error(`Unexpected S3 command: ${command.constructor.name}`)
        }
    }
    class FakeRedisCluster {
        async flushall() {
            throw new Error('API teardown must not flushall')
        }
        async quit() {}
        async scan(_cursor, _matchKeyword, pattern) {
            const literalScope = pattern.replaceAll('*', '')
            return ['0', [ownRedisKey, otherRedisKey].filter((key) => key.includes(literalScope))]
        }
        async unlink(key) {
            deletedRedisKeys.push(key)
        }
    }

    const originalLoad = Module._load
    const previousEnvironment = snapshotEnvironment([
        'API_VITEST_RUN_ID',
        'MONGO_URI',
        'REDIS_HOST1',
        'REDIS_HOST2',
        'REDIS_HOST3',
        'REDIS_PORT1',
        'REDIS_PORT2',
        'REDIS_PORT3',
        'S3_ACCESS_KEY',
        'S3_ENDPOINT',
        'S3_FORCE_PATH_STYLE',
        'S3_REGION',
        'S3_SECRET_KEY'
    ])
    Object.assign(process.env, {
        API_VITEST_RUN_ID: RUN_A,
        MONGO_URI: 'mongodb://mock',
        REDIS_HOST1: 'redis-1',
        REDIS_HOST2: 'redis-2',
        REDIS_HOST3: 'redis-3',
        REDIS_PORT1: '7001',
        REDIS_PORT2: '7002',
        REDIS_PORT3: '7003',
        S3_ACCESS_KEY: 'key',
        S3_ENDPOINT: 'http://s3.invalid',
        S3_FORCE_PATH_STYLE: 'true',
        S3_REGION: 'us-east-1',
        S3_SECRET_KEY: 'secret'
    })

    Module._load = function loadWithInfrastructureMocked(request, parent, isMain) {
        if (parent?.filename === teardownPath && request === '@aws-sdk/client-s3') {
            return { S3Client: FakeS3Client }
        }
        if (parent?.filename === teardownPath && request === 'mongodb') {
            return { MongoClient: FakeMongoClient }
        }
        if (parent?.filename === teardownPath && request === 'ioredis') {
            return { Cluster: FakeRedisCluster }
        }
        return Reflect.apply(originalLoad, this, [request, parent, isMain])
    }

    try {
        delete require.cache[teardownPath]
        const teardown = require(teardownPath)
        await teardown()
    } finally {
        Module._load = originalLoad
        delete require.cache[teardownPath]
        restoreEnvironment(previousEnvironment)
    }

    assert.deepEqual(droppedDatabases, [ownDatabase])
    assert.deepEqual(deletedBuckets, [ownBucket])
    assert.deepEqual(deletedRedisKeys, [ownRedisKey])
})

function snapshotEnvironment(names) {
    return Object.fromEntries(names.map((name) => [name, process.env[name]]))
}

function restoreEnvironment(previousEnvironment) {
    for (const [name, value] of Object.entries(previousEnvironment)) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
    }
}
