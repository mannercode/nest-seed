import { withTestId } from '@mannercode/testing'
import type { RedisModuleFixture } from './redis.module.fixture'

describe('RedisConnectionRegistry', () => {
    it('quit이 실패한 연결이 있어도 onModuleDestroy는 예외를 전파하지 않는다', async () => {
        const { RedisConnectionRegistry } = await import('../redis.module')
        const registry = new RedisConnectionRegistry()
        const connection = { quit: jest.fn().mockRejectedValue(new Error('boom')) }
        registry.add(connection as any)

        await expect(registry.onModuleDestroy()).resolves.toBeUndefined()
        expect(connection.quit).toHaveBeenCalled()
    })
})

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

        it('URL과 함께 준 옵션이 실제 연결에 적용된다', async () => {
            const { createRedisModuleDbSelectionFixture } = await import('./redis.module.fixture')
            const fix = await createRedisModuleDbSelectionFixture()
            try {
                const key = withTestId('db-selection')
                await fix.redisDb1.set(key, 'value')

                // db 1 연결의 키가 기본 db 연결에서 보이지 않아야 options가 버려지지 않은 것이다.
                expect(await fix.redisDb0.get(key)).toBeNull()
                expect(await fix.redisDb1.get(key)).toBe('value')
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
