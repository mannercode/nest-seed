import type { CacheServiceFixture } from './cache.service.fixture'
import { sleep } from '../../utils/functions'

describe('CacheService', () => {
    let fix: CacheServiceFixture

    beforeEach(async () => {
        const { createCacheServiceFixture } = await import('./cache.service.fixture')
        fix = await createCacheServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('set', () => {
        // TTL이 제공되지 않을 때
        describe('when the TTL is not provided', () => {
            // 값을 저장한다
            it('stores the value', async () => {
                await fix.cacheService.set('key', 'value')
                const cachedValue = await fix.cacheService.get('key')
                expect(cachedValue).toEqual('value')
            })
        })

        // TTL이 제공될 때
        describe('when a TTL is provided', () => {
            let ttl: number

            beforeEach(() => {
                ttl = 1000
            })

            // TTL 이후에 만료된다
            it('expires after the TTL', async () => {
                await fix.cacheService.set('key', 'value', ttl)

                const beforeExpiration = await fix.cacheService.get('key')
                expect(beforeExpiration).toEqual('value')

                await sleep(ttl * 1.1)

                const afterExpiration = await fix.cacheService.get('key')
                expect(afterExpiration).toBeNull()
            })
        })

        // TTL이 0일 때
        describe('when the TTL is 0', () => {
            let ttl: number

            beforeEach(() => {
                ttl = 0
            })

            // 만료되지 않는다
            it('does not expire', async () => {
                await fix.cacheService.set('key', 'value', ttl)

                const beforeExpiration = await fix.cacheService.get('key')
                expect(beforeExpiration).toEqual('value')

                await sleep(1000)

                const afterExpiration = await fix.cacheService.get('key')
                expect(afterExpiration).toEqual('value')
            })
        })

        // TTL이 음수일 때
        describe('when the TTL is negative', () => {
            let invalidTtl: number

            beforeEach(() => {
                invalidTtl = -100
            })

            // 예외를 던진다
            it('throws', async () => {
                await expect(fix.cacheService.set('key', 'value', invalidTtl)).rejects.toThrow(
                    'TTL must be a non-negative integer (0 for no expiration)'
                )
            })
        })
    })

    describe('delete', () => {
        // 키가 존재할 때
        describe('when the key exists', () => {
            // 캐시된 값을 삭제한다
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
        // 스크립트를 실행하고 결과를 반환한다
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
