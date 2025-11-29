import { sleep } from 'common'
import type { Fixture } from './cache.service.fixture'

describe('CacheService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./cache.service.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('set', () => {
        describe('when setting a value', () => {
            it('stores the value', async () => {
                await fixture.cacheService.set('key', 'value')
                const cachedValue = await fixture.cacheService.get('key')
                expect(cachedValue).toEqual('value')
            })
        })

        describe('when the TTL is provided', () => {
            it('expires after the TTL', async () => {
                const ttl = 1000
                await fixture.cacheService.set('key', 'value', ttl)

                const beforeExpiration = await fixture.cacheService.get('key')
                expect(beforeExpiration).toEqual('value')

                await sleep(ttl * 1.1)

                const afterExpiration = await fixture.cacheService.get('key')
                expect(afterExpiration).toBeNull()
            })
        })

        describe('when the TTL is 0', () => {
            it('does not expire', async () => {
                const ttl = 0
                await fixture.cacheService.set('key', 'value', ttl)

                const beforeExpiration = await fixture.cacheService.get('key')
                expect(beforeExpiration).toEqual('value')

                await sleep(1000)

                const afterExpiration = await fixture.cacheService.get('key')
                expect(afterExpiration).toEqual('value')
            })
        })

        describe('when the TTL is negative', () => {
            it('throws an error', async () => {
                const wrongTTL = -100

                await expect(fixture.cacheService.set('key', 'value', wrongTTL)).rejects.toThrow(
                    'TTL must be a non-negative integer (0 for no expiration)'
                )
            })
        })
    })

    describe('delete', () => {
        describe('when the key exists', () => {
            it('deletes the cached value', async () => {
                await fixture.cacheService.set('key', 'value')

                const beforeDelete = await fixture.cacheService.get('key')
                expect(beforeDelete).toEqual('value')

                await fixture.cacheService.delete('key')

                const afterDelete = await fixture.cacheService.get('key')
                expect(afterDelete).toBeNull()
            })
        })
    })

    describe('executeScript', () => {
        describe('when running a Lua script', () => {
            it('runs the script and returns the result', async () => {
                const script = `return redis.call('SET', KEYS[1], ARGV[2])`
                const keys = ['key']
                const args = ['value']

                const result = await fixture.cacheService.executeScript(script, keys, args)
                expect(result).toBe('OK')

                const storedValue = await fixture.cacheService.get('key')
                expect(storedValue).toBe('value')
            })
        })
    })
})
