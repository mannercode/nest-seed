import { sleep } from 'common'
import type { CacheServiceFixture } from './cache.service.fixture'

describe('CacheService', () => {
    let fix: CacheServiceFixture

    beforeEach(async () => {
        const { createCacheServiceFixture } = await import('./cache.service.fixture')
        fix = await createCacheServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('set', () => {
        describe('when the TTL is not provided', () => {
            it('stores the value', async () => {
                await fix.cacheService.set('key', 'value')
                const cachedValue = await fix.cacheService.get('key')
                expect(cachedValue).toEqual('value')
            })
        })

        describe('when a TTL is provided', () => {
            it('expires after the TTL', async () => {
                const ttl = 1000
                await fix.cacheService.set('key', 'value', ttl)

                const beforeExpiration = await fix.cacheService.get('key')
                expect(beforeExpiration).toEqual('value')

                await sleep(ttl * 1.1)

                const afterExpiration = await fix.cacheService.get('key')
                expect(afterExpiration).toBeNull()
            })
        })

        describe('when the TTL is 0', () => {
            it('does not expire', async () => {
                const ttl = 0
                await fix.cacheService.set('key', 'value', ttl)

                const beforeExpiration = await fix.cacheService.get('key')
                expect(beforeExpiration).toEqual('value')

                await sleep(1000)

                const afterExpiration = await fix.cacheService.get('key')
                expect(afterExpiration).toEqual('value')
            })
        })

        describe('when the TTL is negative', () => {
            it('throws', async () => {
                const wrongTTL = -100

                await expect(fix.cacheService.set('key', 'value', wrongTTL)).rejects.toThrow(
                    'TTL must be a non-negative integer (0 for no expiration)'
                )
            })
        })
    })

    describe('delete', () => {
        describe('when the key exists', () => {
            it('deletes the cached value', async () => {
                await fix.cacheService.set('key', 'value')

                const beforeDelete = await fix.cacheService.get('key')
                expect(beforeDelete).toEqual('value')

                await fix.cacheService.delete('key')

                const afterDelete = await fix.cacheService.get('key')
                expect(afterDelete).toBeNull()
            })
        })
    })

    describe('executeScript', () => {
        it('runs the script and returns the result', async () => {
            const script = `return redis.call('SET', KEYS[1], ARGV[2])`
            const keys = ['key']
            const args = ['value']

            const result = await fix.cacheService.executeScript(script, keys, args)
            expect(result).toBe('OK')

            const storedValue = await fix.cacheService.get('key')
            expect(storedValue).toBe('value')
        })
    })
})
