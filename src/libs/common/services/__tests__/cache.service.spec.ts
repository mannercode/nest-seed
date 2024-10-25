import { CacheModule } from '@nestjs/cache-manager'
import { Test, TestingModule } from '@nestjs/testing'
import { sleep } from 'common'
import { CACHE_TAG, CacheService } from '..'

describe('CacheService', () => {
    let module: TestingModule
    let cacheService: CacheService

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [CacheModule.register()],
            providers: [CacheService, { provide: CACHE_TAG, useValue: 'myTag' }]
        }).compile()

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
        expect(deletedValue).toBeUndefined()
    })

    it('sets an expiration time', async () => {
        const ttl = 1000

        await cacheService.set(key, value, ttl)
        const initialValue = await cacheService.get(key)
        expect(initialValue).toEqual(value)

        await sleep(1000 + 100)
        const deletedValue = await cacheService.get(key)
        expect(deletedValue).toBeUndefined()
    })

    it('throws an exception if the expiration time is negative', async () => {
        const wrongTTL = -100

        await expect(cacheService.set(key, value, wrongTTL)).rejects.toThrow(Error)
    })
})
