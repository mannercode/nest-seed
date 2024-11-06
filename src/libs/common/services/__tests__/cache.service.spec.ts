import { TestingModule } from '@nestjs/testing'
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis'
import { sleep } from 'common'
import { createTestingModule } from 'testlib'
import { CacheModule, CacheService } from '..'

describe('CacheService', () => {
    let module: TestingModule
    let cacheService: CacheService
    let redisContainer: StartedRedisContainer
    let host: string
    let port: number

    beforeAll(async () => {
        redisContainer = await new RedisContainer().start()
        host = redisContainer.getHost()
        port = redisContainer.getFirstMappedPort()
    }, 120 * 1000)

    afterAll(async () => {
        await redisContainer.stop()
    })

    beforeEach(async () => {
        module = await createTestingModule({
            imports: [
                CacheModule.forRootAsync(
                    {
                        useFactory: () => ({
                            type: 'single',
                            nodes: [{ host, port }],
                            prefix: 'prefix'
                        })
                    },
                    'connName'
                )
            ]
        })

        cacheService = module.get(CacheService)
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

describe('CacheModule', () => {
    let module: TestingModule
    let cacheServices: CacheService[]
    let redisContainer1: StartedRedisContainer
    let redisContainer2: StartedRedisContainer

    beforeEach(async () => {
        redisContainer1 = await new RedisContainer().start()
        redisContainer2 = await new RedisContainer().start()

        module = await createTestingModule({
            imports: [
                CacheModule.forRootAsync(
                    {
                        useFactory: () => ({
                            type: 'single',
                            nodes: [
                                {
                                    host: redisContainer1.getHost(),
                                    port: redisContainer1.getFirstMappedPort()
                                }
                            ],
                            prefix: 'prefix'
                        })
                    },
                    'connection1'
                ),
                CacheModule.forRootAsync(
                    {
                        useFactory: () => ({
                            type: 'single',
                            nodes: [
                                {
                                    host: redisContainer2.getHost(),
                                    port: redisContainer2.getFirstMappedPort()
                                }
                            ],
                            prefix: 'prefix'
                        })
                    },
                    'connection2'
                )
            ]
        })

        cacheServices = module.get(CacheService, { each: true })
    }, 120 * 1000)

    afterEach(async () => {
        if (module) await module.close()

        await redisContainer1.stop()
        await redisContainer2.stop()
    })

    it('CacheService 인스턴스는 2개여야 한다', async () => {
        expect(cacheServices).toHaveLength(2)
    })

    it('각각의 CacheService는 서로 다른 Redis를 사용해야 한다', async () => {
        await cacheServices[0].set('key1', 'value1')
        expect(await cacheServices[0].get('key1')).toEqual('value1')
        expect(await cacheServices[1].get('key1')).toBeNull()

        await cacheServices[1].set('key2', 'value2')
        expect(await cacheServices[1].get('key2')).toEqual('value2')
        expect(await cacheServices[0].get('key2')).toBeNull()
    })
})
