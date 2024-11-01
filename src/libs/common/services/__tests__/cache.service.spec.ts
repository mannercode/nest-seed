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
        port = redisContainer.getMappedPort(6379)
    }, 60 * 1000)

    afterAll(async () => {
        await redisContainer.stop()
    })

    beforeEach(async () => {
        module = await createTestingModule({
            imports: [
                CacheModule.forRootAsync({ useFactory: () => ({ host, port, prefix: 'test' }) })
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
})
