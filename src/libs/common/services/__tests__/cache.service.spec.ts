import { TestingModule } from '@nestjs/testing'
import { CacheModule, CacheService, getCacheServiceToken, RedisModule, sleep } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection } from 'testlib'

describe('CacheService', () => {
    let module: TestingModule
    let cacheService: CacheService

    beforeEach(async () => {
        const redisCtx = getRedisTestConnection()

        module = await createTestingModule({
            imports: [
                RedisModule.forRootAsync(
                    {
                        useFactory: () => ({
                            type: 'cluster',
                            nodes: redisCtx.nodes,
                            password: redisCtx.password,
                            prefix: 'prefix'
                        })
                    },
                    'redis'
                ),
                CacheModule.forRootAsync(
                    {
                        useFactory: (redis: Redis) => ({
                            redis,
                            prefix: 'prefix'
                        }),
                        inject: [RedisModule.getConnectionToken('redis')]
                    },
                    'connName'
                )
            ]
        })

        cacheService = module.get(getCacheServiceToken('connName'))
    })

    afterEach(async () => {
        if (module) await module.close()
    })

    const key = 'key'
    const value = 'value'

    it('sets a value in the cache', async () => {
        await cacheService.set(key, value)
        const cachedValue = await cacheService.get(key)

        expect(cachedValue).toEqual(value)
    })

    it('deletes a value from the cache', async () => {
        await cacheService.set(key, value)
        const initialValue = await cacheService.get(key)
        expect(initialValue).toEqual(value)

        await cacheService.delete(key)
        const deletedValue = await cacheService.get(key)
        expect(deletedValue).toBeNull()
    })

    it('sets an expiration time', async () => {
        const ttl = 1000

        await cacheService.set(key, value, ttl)
        const initialValue = await cacheService.get(key)
        expect(initialValue).toEqual(value)

        await sleep(1000 + 100)
        const deletedValue = await cacheService.get(key)
        expect(deletedValue).toBeNull()
    })

    it('throws an exception if the expiration time is negative', async () => {
        const wrongTTL = -100

        await expect(cacheService.set(key, value, wrongTTL)).rejects.toThrow(Error)
    })

    it('should execute Lua script and set keys correctly', async () => {
        const script = `return redis.call('SET', KEYS[1], ARGV[1])`
        const keys = ['key1']
        const args = ['value1']

        const result = await cacheService.executeScript(script, keys, args)
        expect(result).toBe('OK')

        const storedValue = await cacheService.get('key1')
        expect(storedValue).toBe('value1')
    })
})
