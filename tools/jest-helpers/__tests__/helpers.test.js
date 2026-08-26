const assert = require('node:assert/strict')
const test = require('node:test')
const {
    CreateBucketCommand,
    DeleteBucketCommand,
    DeleteObjectsCommand,
    ListBucketsCommand,
    ListObjectsV2Command
} = require('@aws-sdk/client-s3')

const {
    cleanCollections,
    cleanupRedisMatching,
    createGlobalTeardown,
    createJestResourceScope,
    dropMatchingBuckets,
    emptyBucket,
    ensureBucket,
    generateTestId,
    setupJestLifecycle
} = require('..')

const RUN_ID = '0123456789abcdef0123456789abcdef'

function captureLifecycle(register) {
    const originals = {
        afterAll: global.afterAll,
        afterEach: global.afterEach,
        beforeAll: global.beforeAll,
        beforeEach: global.beforeEach
    }
    const hooks = {}
    global.afterAll = (callback) => (hooks.afterAll = callback)
    global.afterEach = (callback) => (hooks.afterEach = callback)
    global.beforeAll = (callback) => (hooks.beforeAll = callback)
    global.beforeEach = (callback) => (hooks.beforeEach = callback)
    try {
        register()
    } finally {
        Object.assign(global, originals)
    }
    return hooks
}

function createEmptyInfrastructure() {
    const mongo = {
        async close() {},
        db(name) {
            if (name === undefined) {
                return { admin: () => ({ listDatabases: async () => ({ databases: [] }) }) }
            }
            return { async dropDatabase() {} }
        }
    }
    const s3 = {
        destroy() {},
        async send(command) {
            if (command instanceof ListBucketsCommand) return {}
            throw new Error(`Unexpected S3 command: ${command.constructor.name}`)
        }
    }
    return { mongo, s3 }
}

test('resource scope는 숫자가 아닌 worker ID를 거부한다', () => {
    const scope = createJestResourceScope(RUN_ID)

    assert.throws(() => scope.databaseName('worker-1'), /worker ID/)
    assert.throws(() => createJestResourceScope(), /run ID/)
})

test('test ID는 고정 길이의 허용 문자로 생성된다', () => {
    const testId = generateTestId()

    assert.match(testId, /^[A-Za-z0-9]{10}$/)
})

test('Mongo collection 정리는 조회된 모든 collection을 비운다', async () => {
    const deleted = []
    let activeDeletes = 0
    let maxActiveDeletes = 0
    const collections = ['first', 'second'].map((name) => ({
        async deleteMany(filter) {
            activeDeletes += 1
            maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes)
            await new Promise((resolve) => setImmediate(resolve))
            deleted.push({ filter, name })
            activeDeletes -= 1
        }
    }))
    const mongo = { db: () => ({ collections: async () => collections }) }

    await cleanCollections(mongo, 'test-db')

    assert.deepEqual(deleted, [
        { filter: {}, name: 'first' },
        { filter: {}, name: 'second' }
    ])
    assert.equal(maxActiveDeletes, 1)
})

test('S3 bucket 생성은 성공과 이미 존재하는 경우만 허용한다', async () => {
    const created = []
    await ensureBucket(
        {
            async send(command) {
                created.push(command)
            }
        },
        'bucket'
    )
    assert.ok(created[0] instanceof CreateBucketCommand)

    for (const name of ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists']) {
        await assert.doesNotReject(
            ensureBucket(
                {
                    async send() {
                        throw Object.assign(new Error(name), { name })
                    }
                },
                'bucket'
            )
        )
    }

    await assert.rejects(
        ensureBucket(
            {
                async send() {
                    throw new Error('network failure')
                }
            },
            'bucket'
        ),
        /network failure/
    )
})

test('S3 bucket 정리는 pagination을 따라 모든 object를 삭제한다', async () => {
    const commands = []
    const s3 = {
        async send(command) {
            commands.push(command)
            if (!(command instanceof ListObjectsV2Command)) return {}
            if (command.input.ContinuationToken === undefined) {
                return {
                    Contents: [{ Key: 'first' }, { Key: 'second' }],
                    IsTruncated: true,
                    NextContinuationToken: 'next-page'
                }
            }
            return { Contents: [], IsTruncated: false }
        }
    }

    await emptyBucket(s3, 'bucket')

    const deletes = commands.filter((command) => command instanceof DeleteObjectsCommand)
    assert.deepEqual(
        deletes.map((command) => command.input.Delete.Objects),
        [[{ Key: 'first' }, { Key: 'second' }]]
    )
    const lists = commands.filter((command) => command instanceof ListObjectsV2Command)
    assert.deepEqual(
        lists.map((command) => command.input.ContinuationToken),
        [undefined, 'next-page']
    )
})

test('S3 bucket 목록이 없으면 삭제를 시도하지 않는다', async () => {
    let calls = 0

    await dropMatchingBuckets(
        {
            async send(command) {
                calls += 1
                assert.ok(command instanceof ListBucketsCommand)
                return {}
            }
        },
        /^s3bucket-/
    )
    await emptyBucket(
        {
            async send(command) {
                assert.ok(command instanceof ListObjectsV2Command)
                return {}
            }
        },
        'already-empty'
    )

    assert.equal(calls, 1)
})

test('Jest lifecycle은 worker 자원 준비, 테스트별 정리, 종료를 연결한다', async () => {
    const events = []
    const mongo = {
        async close() {
            events.push('mongo.close')
        },
        db: () => ({
            collections: async () => [
                {
                    async deleteMany() {
                        events.push('mongo.clean')
                    }
                }
            ]
        })
    }
    const s3 = {
        destroy() {
            events.push('s3.destroy')
        },
        async send(command) {
            if (command instanceof CreateBucketCommand) events.push('s3.create')
            else if (command instanceof ListObjectsV2Command) events.push('s3.list')
            else throw new Error(`Unexpected S3 command: ${command.constructor.name}`)
            return {}
        }
    }
    let beforeEachTestId
    const previousWorkerId = process.env.JEST_WORKER_ID
    process.env.JEST_WORKER_ID = '7'
    const hooks = captureLifecycle(() =>
        setupJestLifecycle({
            afterMongoConnect: async (client, dbName) => {
                assert.equal(client, mongo)
                assert.equal(dbName, 'mongo-worker-7')
                events.push('mongo.connected')
            },
            bucketName: (workerId) => `bucket-worker-${workerId}`,
            connectMongo: async (workerId) => ({
                client: mongo,
                dbName: `mongo-worker-${workerId}`
            }),
            createS3Client: () => s3,
            onBeforeEach: async (testId) => {
                beforeEachTestId = testId
            }
        })
    )
    try {
        await hooks.beforeAll()
        await hooks.beforeEach()
        await hooks.afterEach()
        await hooks.afterAll()
    } finally {
        if (previousWorkerId === undefined) delete process.env.JEST_WORKER_ID
        else process.env.JEST_WORKER_ID = previousWorkerId
    }

    assert.match(beforeEachTestId, /^[A-Za-z0-9]{10}$/)
    assert.equal(process.env.TEST_ID, beforeEachTestId)
    assert.deepEqual(events.slice(0, 2), ['mongo.connected', 's3.create'])
    assert.equal(events.filter((event) => event === 'mongo.clean').length, 2)
    assert.equal(events.filter((event) => event === 's3.list').length, 2)
    assert.deepEqual(events.slice(-2), ['mongo.close', 's3.destroy'])
})

test('Jest lifecycle의 선택 callback과 부분 초기화 정리는 없어도 안전하다', async () => {
    const mongo = { async close() {}, db: () => ({ collections: async () => [] }) }
    const s3 = {
        destroy() {},
        async send(command) {
            if (command instanceof CreateBucketCommand || command instanceof ListObjectsV2Command) {
                return {}
            }
            throw new Error(`Unexpected S3 command: ${command.constructor.name}`)
        }
    }
    const completeHooks = captureLifecycle(() =>
        setupJestLifecycle({
            bucketName: () => 'bucket',
            connectMongo: async () => ({ client: mongo, dbName: 'database' }),
            createS3Client: () => s3
        })
    )
    await completeHooks.beforeAll()
    await completeHooks.beforeEach()
    await completeHooks.afterAll()

    const failedHooks = captureLifecycle(() =>
        setupJestLifecycle({
            bucketName: () => 'never-created',
            connectMongo: async () => {
                throw new Error('mongo unavailable')
            },
            createS3Client: () => {
                throw new Error('must not be called')
            }
        })
    )
    await assert.rejects(failedHooks.beforeAll(), /mongo unavailable/)
    await assert.doesNotReject(failedHooks.afterAll())
})

test('global teardown은 명시적 opt-in에서만 Redis 전체를 정리한다', async () => {
    const events = []
    const listeners = {}
    const master = {
        async flushall() {
            events.push('redis.flushall')
        }
    }
    const redis = {
        status: 'connecting',
        nodes(kind) {
            assert.equal(kind, 'master')
            return [master]
        },
        once(event, callback) {
            listeners[event] = callback
            if (event === 'error') queueMicrotask(() => listeners.ready())
        },
        async quit() {
            events.push('redis.quit')
        }
    }
    const { mongo, s3 } = createEmptyInfrastructure()
    const teardown = createGlobalTeardown({
        allowRedisFlushAll: true,
        connectMongo: async () => mongo,
        connectRedis: () => redis,
        createS3Client: () => s3,
        extra: async () => events.push('extra')
    })

    await teardown()

    assert.deepEqual(events.sort(), ['extra', 'redis.flushall', 'redis.quit'].sort())
})

test('global teardown은 Redis 정리 범위가 없으면 연결 전에 fail closed한다', () => {
    const { mongo, s3 } = createEmptyInfrastructure()
    let connected = false

    assert.throws(
        () =>
            createGlobalTeardown({
                connectMongo: async () => mongo,
                connectRedis: () => {
                    connected = true
                    throw new Error('must not connect')
                },
                createS3Client: () => s3
            }),
        /redisKeyPattern.*allowRedisFlushAll/
    )
    assert.equal(connected, false)
})

test('global teardown은 scoped pattern과 FLUSHALL opt-in을 동시에 받지 않는다', () => {
    const { mongo, s3 } = createEmptyInfrastructure()

    assert.throws(
        () =>
            createGlobalTeardown({
                allowRedisFlushAll: true,
                connectMongo: async () => mongo,
                connectRedis: () => ({ async quit() {} }),
                createS3Client: () => s3,
                redisKeyPattern: 'scope:*'
            }),
        /must not combine/
    )
})

test('global teardown은 scoped pattern과 함께 긴 Redis scope marker를 요구한다', () => {
    const { mongo, s3 } = createEmptyInfrastructure()

    assert.throws(
        () =>
            createGlobalTeardown({
                connectMongo: async () => mongo,
                connectRedis: () => ({ async quit() {} }),
                createS3Client: () => s3,
                redisKeyPattern: 'scope-0123456789abcdef:*'
            }),
        /redisKeyScope/
    )
})

test('Redis cluster master가 없으면 scoped cleanup이 조용히 성공하지 않는다', async () => {
    let quit = false
    const redis = {
        status: 'ready',
        nodes: () => [],
        async quit() {
            quit = true
        }
    }

    await assert.rejects(
        cleanupRedisMatching(() => redis, 'scope-0123456789abcdef:*', 'scope-0123456789abcdef'),
        /no master nodes/
    )
    assert.equal(quit, true)
})

test('Redis SCAN pagination은 전달된 glob으로 찾은 key를 모두 unlink한다', async () => {
    const redisKeyScope = 'scope-0123456789abcdef'
    const redisKeyPattern = `${redisKeyScope}:*`
    const patterns = []
    const deleted = []
    let scanCount = 0
    const redis = {
        async quit() {},
        async scan(_cursor, _matchKeyword, pattern) {
            patterns.push(pattern)
            scanCount += 1
            return scanCount === 1 ? ['next', ['scope:first']] : ['0', ['scope:second']]
        },
        async unlink(key) {
            deleted.push(key)
        }
    }

    await cleanupRedisMatching(() => redis, redisKeyPattern, redisKeyScope)

    assert.deepEqual(patterns, [redisKeyPattern, redisKeyPattern])
    assert.deepEqual(deleted, ['scope:first', 'scope:second'])
})

test('Redis scoped cleanup은 빈 값과 문자열이 아닌 pattern도 거부한다', async () => {
    for (const pattern of ['', undefined]) {
        await assert.rejects(
            cleanupRedisMatching(
                () => {
                    throw new Error('must not connect')
                },
                pattern,
                'scope-0123456789abcdef'
            ),
            /scoped Redis key pattern/
        )
    }
})

test('Redis scoped cleanup은 pattern에 긴 고정 scope marker를 요구한다', async () => {
    for (const options of [
        { pattern: 'a*', scope: 'a' },
        { pattern: 'prefix:*', scope: undefined },
        { pattern: '*0123456789abcdef*', scope: 'fedcba9876543210' },
        { pattern: '[0123456789abcdef]*', scope: '0123456789abcdef' },
        { pattern: '[\\]0123456789abcdef]*', scope: '0123456789abcdef' }
    ]) {
        await assert.rejects(
            cleanupRedisMatching(
                () => {
                    throw new Error('must not connect')
                },
                options.pattern,
                options.scope
            ),
            /redisKeyScope/
        )
    }
})
