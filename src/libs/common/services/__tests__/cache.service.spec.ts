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
        // 값을 설정하는 경우
        describe('when setting a value', () => {
            // 캐시에 값을 저장한다
            it('stores the value', async () => {
                await fixture.cacheService.set('key', 'value')
                const cachedValue = await fixture.cacheService.get('key')
                expect(cachedValue).toEqual('value')
            })
        })

        // TTL을 지정하는 경우
        describe('when TTL is provided', () => {
            // TTL 이후 만료된다
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

        // TTL이 0인 경우
        describe('when TTL is 0', () => {
            // 만료되지 않는다
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

        // TTL이 0 미만인 경우
        describe('when TTL is negative', () => {
            // 예외를 던진다
            it('throws an error', async () => {
                const wrongTTL = -100

                await expect(fixture.cacheService.set('key', 'value', wrongTTL)).rejects.toThrow(
                    'TTL must be a non-negative integer (0 for no expiration)'
                )
            })
        })
    })

    describe('delete', () => {
        // 값이 존재하는 경우
        describe('when the key exists', () => {
            // 캐시에서 값을 삭제한다
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
        // Lua 스크립트를 실행하는 경우
        describe('when running a Lua script', () => {
            // 스크립트를 실행하고 결과를 반환한다
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
