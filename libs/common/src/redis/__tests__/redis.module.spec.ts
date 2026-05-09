import type { RedisModuleFixture } from './redis.module.fixture'

describe('RedisModule', () => {
    describe('forRoot', () => {
        it('URL로 연결할 수 있다', async () => {
            const { createRedisModuleFixture } = await import('./redis.module.fixture')
            const fix = await createRedisModuleFixture()
            try {
                const result = await fix.redis.ping()
                expect(result).toBe('PONG')
            } finally {
                await fix.teardown()
            }
        })

        it('커넥션 이름을 지정해 연결할 수 있다', async () => {
            const { createRedisModuleNamedFixture } = await import('./redis.module.fixture')
            const fix = await createRedisModuleNamedFixture()
            try {
                const result = await fix.redis.ping()
                expect(result).toBe('PONG')
            } finally {
                await fix.teardown()
            }
        })

        it('URL과 옵션을 함께 주면 연결할 수 있다', async () => {
            const { createRedisModuleUrlWithOptionsFixture } =
                await import('./redis.module.fixture')
            const fix = await createRedisModuleUrlWithOptionsFixture()
            try {
                const result = await fix.redis.ping()
                expect(result).toBe('PONG')
            } finally {
                await fix.teardown()
            }
        })

        it('옵션만 주면 연결할 수 있다', async () => {
            const { createRedisModuleOptionsOnlyFixture } = await import('./redis.module.fixture')
            const fix = await createRedisModuleOptionsOnlyFixture()
            try {
                const result = await fix.redis.ping()
                expect(result).toBe('PONG')
            } finally {
                await fix.teardown()
            }
        })
    })

    describe('forRootAsync', () => {
        let fix: RedisModuleFixture

        beforeEach(async () => {
            const { createRedisModuleAsyncFixture } = await import('./redis.module.fixture')
            fix = await createRedisModuleAsyncFixture()
        })
        afterEach(() => fix.teardown())

        it('비동기로 연결할 수 있다', async () => {
            const result = await fix.redis.ping()
            expect(result).toBe('PONG')
        })
    })
})
