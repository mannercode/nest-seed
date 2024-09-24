import { CacheModule } from '@nestjs/cache-manager'
import { Test, TestingModule } from '@nestjs/testing'
import { sleep } from 'common'
import { CacheService } from '..'

describe('CacheService', () => {
    let module: TestingModule
    let cacheService: CacheService

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [CacheModule.register()],
            providers: [CacheService]
        }).compile()

        cacheService = module.get(CacheService)
    })

    afterEach(async () => {
        if (module) await module.close()
    })

    it('sets a value in the cache', async () => {
        const key = 'key'
        const value = 'value'

        await cacheService.set(key, value)
        const cachedValue = await cacheService.get(key)

        expect(cachedValue).toEqual(value)
    })

    it('deletes a value from the cache', async () => {
        const key = 'key'
        const value = 'value'

        await cacheService.set(key, value)
        const initialValue = await cacheService.get(key)
        expect(initialValue).toEqual(value)

        await cacheService.delete(key)
        const deletedValue = await cacheService.get(key)
        expect(deletedValue).toBeUndefined()
    })

    it('sets an expiration time', async () => {
        const key = 'key'
        const value = 'value'
        const ttl = '1s'

        await cacheService.set(key, value, ttl)
        const initialValue = await cacheService.get(key)
        expect(initialValue).toEqual(value)

        await sleep(1000 + 100)
        const deletedValue = await cacheService.get(key)
        expect(deletedValue).toBeUndefined()
    })

    it('expresses milliseconds as a decimal', async () => {
        const key = 'key'
        const value = 'value'
        const ttl = '0.5s'

        await cacheService.set(key, value, ttl)
        const initialValue = await cacheService.get(key)
        expect(initialValue).toEqual(value)

        await sleep(500 + 100)
        const deletedValue = await cacheService.get(key)
        expect(deletedValue).toBeUndefined()
    })

    it('throws an exception if the expiration time is negative', async () => {
        const key = 'key'
        const value = 'value'
        const wrongTTL = '-1s'

        await expect(cacheService.set(key, value, wrongTTL)).rejects.toThrow(Error)
    })
})
