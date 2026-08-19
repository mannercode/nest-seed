const assert = require('node:assert/strict')
const test = require('node:test')
const {
    DeleteBucketCommand,
    ListBucketsCommand,
    ListObjectsV2Command
} = require('@aws-sdk/client-s3')

const {
    createJestResourceRunId,
    createJestResourceScope,
    createGlobalTeardown,
    cleanupRedisMatching
} = require('..')

const RUN_A = '0123456789abcdef0123456789abcdef'
const RUN_B = 'fedcba9876543210fedcba9876543210'

function matchesRedisGlob(value, glob) {
    const source = glob
        .split('*')
        .map((part) => part.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'))
        .join('.*')
    return new RegExp(`^${source}$`).test(value)
}

test('독립 Jest 실행은 같은 worker 번호에도 서로 다른 Mongo와 S3 자원을 쓴다', () => {
    const first = createJestResourceScope(RUN_A)
    const second = createJestResourceScope(RUN_B)

    assert.notEqual(first.databaseName('1'), second.databaseName('1'))
    assert.notEqual(first.bucketName('1'), second.bucketName('1'))
    assert.notEqual(first.projectId('test-id'), second.projectId('test-id'))
    assert.equal(first.redisKeyScope, RUN_A)
    assert.equal(second.redisKeyScope, RUN_B)
})

test('현재 실행의 정리 패턴은 다른 실행이나 운영 자원을 선택하지 않는다', () => {
    const first = createJestResourceScope(RUN_A)
    const second = createJestResourceScope(RUN_B)

    assert.match(first.databaseName('1'), first.databasePattern)
    assert.match(first.databaseName('12'), first.databasePattern)
    assert.doesNotMatch(second.databaseName('1'), first.databasePattern)
    assert.doesNotMatch('production', first.databasePattern)

    assert.match(first.bucketName('1'), first.bucketPattern)
    assert.match(first.bucketName('12'), first.bucketPattern)
    assert.doesNotMatch(second.bucketName('1'), first.bucketPattern)
    assert.doesNotMatch('production-assets', first.bucketPattern)
})

test('실행 ID와 S3 버킷 이름은 충돌 방지에 충분한 안전한 형식이다', () => {
    const runId = createJestResourceRunId()
    const bucket = createJestResourceScope(runId).bucketName('999')

    assert.match(runId, /^[a-f0-9]{32}$/)
    assert.match(bucket, /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)
    assert.ok(bucket.length <= 63)
})

test('실행 ID가 없거나 안전한 형식이 아니면 넓은 정리 패턴을 만들지 않는다', () => {
    for (const runId of ['', 'same-run', '../production', 'A'.repeat(32)]) {
        assert.throws(() => createJestResourceScope(runId), /Jest resource run ID/)
    }
})

test('Redis 정리는 현재 실행의 key만 삭제하고 다른 실행 key를 보존한다', async () => {
    const first = createJestResourceScope(RUN_A)
    const second = createJestResourceScope(RUN_B)
    const keys = [
        `cache:${first.projectId('one')}:value`,
        `jwtauth:${first.projectId('two')}:family`,
        `cache:${second.projectId('one')}:value`,
        'production:key'
    ]
    const deleted = []
    const redis = {
        async quit() {},
        async scan(cursor, matchKeyword, pattern, countKeyword, count) {
            assert.equal(cursor, '0')
            assert.equal(matchKeyword, 'MATCH')
            assert.equal(pattern, first.redisKeyPattern)
            assert.equal(countKeyword, 'COUNT')
            assert.equal(count, '100')
            return ['0', keys.filter((key) => matchesRedisGlob(key, pattern))]
        },
        async unlink(key) {
            deleted.push(key)
        }
    }

    await cleanupRedisMatching(() => redis, first.redisKeyPattern, first.redisKeyScope)

    assert.deepEqual(deleted, keys.slice(0, 2))
})

test('Redis 정리는 고정 run scope가 없어 전체 key 공간을 훑는 glob을 fail closed로 거부한다', async () => {
    for (const pattern of ['*', '**', '?*', '*?', 'a*', '*:*', '[abc]*', '[^x]*']) {
        let connected = false

        await assert.rejects(
            cleanupRedisMatching(
                () => {
                    connected = true
                    return {
                        async quit() {},
                        async scan() {
                            return ['0', []]
                        }
                    }
                },
                pattern,
                RUN_A
            ),
            /redisKeyScope/
        )
        assert.equal(connected, false, pattern)
    }
})

test('global teardown은 현재 실행의 Mongo, S3, Redis 자원만 제거한다', async () => {
    const first = createJestResourceScope(RUN_A)
    const second = createJestResourceScope(RUN_B)
    const ownDatabase = first.databaseName('1')
    const otherDatabase = second.databaseName('1')
    const ownBucket = first.bucketName('1')
    const otherBucket = second.bucketName('1')
    const ownRedisKey = `cache:${first.projectId('one')}:value`
    const otherRedisKey = `cache:${second.projectId('one')}:value`
    const droppedDatabases = []
    const deletedBuckets = []
    const deletedRedisKeys = []

    const mongo = {
        async close() {},
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
    const s3 = {
        destroy() {},
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
    const redis = {
        async flushall() {
            throw new Error('scoped teardown must not flushall')
        },
        async quit() {},
        async scan(cursor, matchKeyword, pattern, countKeyword, count) {
            assert.equal(cursor, '0')
            assert.equal(matchKeyword, 'MATCH')
            assert.equal(countKeyword, 'COUNT')
            assert.equal(count, '100')
            return [
                '0',
                [ownRedisKey, otherRedisKey].filter((key) => matchesRedisGlob(key, pattern))
            ]
        },
        async unlink(key) {
            deletedRedisKeys.push(key)
        }
    }

    const teardown = createGlobalTeardown({
        bucketPattern: first.bucketPattern,
        connectMongo: async () => mongo,
        connectRedis: () => redis,
        createS3Client: () => s3,
        databasePattern: first.databasePattern,
        redisKeyPattern: first.redisKeyPattern,
        redisKeyScope: first.redisKeyScope
    })
    await teardown()

    assert.deepEqual(droppedDatabases, [ownDatabase])
    assert.deepEqual(deletedBuckets, [ownBucket])
    assert.deepEqual(deletedRedisKeys, [ownRedisKey])
})
