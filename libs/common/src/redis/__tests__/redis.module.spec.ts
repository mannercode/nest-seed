import type { RedisModuleFixture } from './redis.module.fixture'

describe('RedisModule', () => {
    describe('forRoot', () => {
        let fix: RedisModuleFixture

        // URL로 연결한다
        describe('with url', () => {
            beforeEach(async () => {
                const { createRedisModuleFixture } = await import('./redis.module.fixture')
                fix = await createRedisModuleFixture()
            })
            afterEach(() => fix.teardown())

            it('creates a Redis connection', async () => {
                const result = await fix.redis.ping()
                expect(result).toBe('PONG')
            })
        })

        // 커넥션 이름을 지정한다
        describe('with named connection', () => {
            beforeEach(async () => {
                const { createRedisModuleNamedFixture } = await import('./redis.module.fixture')
                fix = await createRedisModuleNamedFixture()
            })
            afterEach(() => fix.teardown())

            it('creates a named Redis connection', async () => {
                const result = await fix.redis.ping()
                expect(result).toBe('PONG')
            })
        })

        // URL과 옵션을 함께 제공한다
        describe('with url and options', () => {
            beforeEach(async () => {
                const { createRedisModuleUrlWithOptionsFixture } =
                    await import('./redis.module.fixture')
                fix = await createRedisModuleUrlWithOptionsFixture()
            })
            afterEach(() => fix.teardown())

            it('creates a Redis connection', async () => {
                const result = await fix.redis.ping()
                expect(result).toBe('PONG')
            })
        })

        // 옵션만 제공한다
        describe('with options only', () => {
            beforeEach(async () => {
                const { createRedisModuleOptionsOnlyFixture } =
                    await import('./redis.module.fixture')
                fix = await createRedisModuleOptionsOnlyFixture()
            })
            afterEach(() => fix.teardown())

            it('creates a Redis connection', async () => {
                const result = await fix.redis.ping()
                expect(result).toBe('PONG')
            })
        })
    })

    describe('forRootAsync', () => {
        let fix: RedisModuleFixture

        beforeEach(async () => {
            const { createRedisModuleAsyncFixture } = await import('./redis.module.fixture')
            fix = await createRedisModuleAsyncFixture()
        })
        afterEach(() => fix.teardown())

        // 비동기로 Redis 연결을 생성한다
        it('creates a Redis connection asynchronously', async () => {
            const result = await fix.redis.ping()
            expect(result).toBe('PONG')
        })
    })
})
