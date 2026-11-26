import { withTestId } from '@mannercode/testing'
import {
    type RedisModuleFixture,
    createRedisModuleFixture,
    createRedisModuleNamedFixture,
    createRedisModuleUrlWithOptionsFixture,
    createRedisModuleDbSelectionFixture,
    createRedisModuleOptionsOnlyFixture,
    createRedisModuleAsyncFixture
} from './redis.module.fixture.js'
import { RedisConnectionRegistry } from '#common/redis'

describe('RedisConnectionRegistry', () => {
    describe('종료할 두 연결 중 하나가 첫 종료에 실패하면', () => {
        let closeSuccessful: ReturnType<typeof vi.fn>
        let registry: RedisConnectionRegistry
        let connection: { quit: ReturnType<typeof vi.fn> }
        beforeEach(() => {
            registry = new RedisConnectionRegistry()
            connection = {
                quit: vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
            }
            closeSuccessful = vi.fn().mockResolvedValue(undefined)
            registry.add({ quit: closeSuccessful } as any)
            registry.add(connection as any)
        })
        it('동시에 종료해도 오류를 공유하고 다시 종료하면 실패했던 연결만 닫는다', async () => {
            const first = registry.onModuleDestroy()
            expect(registry.onModuleDestroy()).toBe(first)
            await expect(first).rejects.toBeInstanceOf(AggregateError)
            await expect(first).rejects.toMatchObject({ errors: [new Error('boom')] })
            expect(closeSuccessful).toHaveBeenCalledTimes(1)
            await registry.onModuleDestroy()
            await registry.onModuleDestroy()
            expect(connection.quit).toHaveBeenCalledTimes(2)
            expect(closeSuccessful).toHaveBeenCalledTimes(1)
        })
    })
})

describe('RedisModule', () => {
    describe('forRoot', () => {
        describe('URL로 연결한 모듈이 있으면', () => {
            let fix: Awaited<ReturnType<typeof createRedisModuleFixture>>
            beforeEach(async () => {
                fix = await createRedisModuleFixture()
            })
            it('연결 상태를 조회하면 PONG을 반환한다', async () => {
                try {
                    const result = await fix.redis.ping()
                    expect(result).toBe('PONG')
                } finally {
                    await fix.teardown()
                }
            })
        })

        describe('이름을 지정해 연결한 모듈이 있으면', () => {
            let fix: Awaited<ReturnType<typeof createRedisModuleNamedFixture>>
            beforeEach(async () => {
                fix = await createRedisModuleNamedFixture()
            })
            it('연결 상태를 조회하면 PONG을 반환한다', async () => {
                try {
                    const result = await fix.redis.ping()
                    expect(result).toBe('PONG')
                } finally {
                    await fix.teardown()
                }
            })
        })

        describe('URL과 옵션으로 연결한 모듈이 있으면', () => {
            let fix: Awaited<ReturnType<typeof createRedisModuleUrlWithOptionsFixture>>
            beforeEach(async () => {
                fix = await createRedisModuleUrlWithOptionsFixture()
            })
            it('연결 상태를 조회하면 PONG을 반환한다', async () => {
                try {
                    const result = await fix.redis.ping()
                    expect(result).toBe('PONG')
                } finally {
                    await fix.teardown()
                }
            })
        })

        describe('URL과 DB 선택 옵션으로 연결한 모듈이 있으면', () => {
            let fix: Awaited<ReturnType<typeof createRedisModuleDbSelectionFixture>>
            beforeEach(async () => {
                fix = await createRedisModuleDbSelectionFixture()
            })
            it('선택한 DB에 값을 저장하면 다른 DB와 격리된다', async () => {
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
        })

        describe('URL 없이 옵션으로 연결한 모듈이 있으면', () => {
            let fix: Awaited<ReturnType<typeof createRedisModuleOptionsOnlyFixture>>
            beforeEach(async () => {
                fix = await createRedisModuleOptionsOnlyFixture()
            })
            it('연결 상태를 조회하면 PONG을 반환한다', async () => {
                try {
                    const result = await fix.redis.ping()
                    expect(result).toBe('PONG')
                } finally {
                    await fix.teardown()
                }
            })
        })
    })

    describe('forRootAsync', () => {
        let fix: RedisModuleFixture

        beforeEach(async () => {
            fix = await createRedisModuleAsyncFixture()
        })
        afterEach(() => fix.teardown())

        it('비동기로 만든 연결에 PING을 보내면 PONG을 반환한다', async () => {
            const result = await fix.redis.ping()
            expect(result).toBe('PONG')
        })
    })
})
