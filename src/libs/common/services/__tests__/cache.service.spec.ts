import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { Injectable } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import { CacheModule, CacheService, InjectCache, sleep } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection, withTestId } from 'testlib'

@Injectable()
export class TestCacheService {
    constructor(@InjectCache('name') _service: CacheService) {}
}

describe('CacheService', () => {
    let module: TestingModule
    let cacheService: CacheService
    let redis: Redis

    beforeEach(async () => {
        const { nodes, password } = getRedisTestConnection()

        module = await createTestingModule({
            imports: [
                RedisModule.forRoot(
                    { type: 'cluster', nodes, options: { redisOptions: { password } } },
                    'redis'
                ),
                CacheModule.register({
                    name: 'name',
                    redisName: 'redis',
                    prefix: withTestId('cache')
                })
            ],
            providers: [TestCacheService]
        })

        cacheService = module.get(CacheService.getToken('name'))
        redis = module.get(getRedisConnectionToken('redis'))
    })

    afterEach(async () => {
        await module?.close()
        await redis.quit()
    })

    const key = 'key'
    const value = 'value'

    it('캐시에 값을 설정해야 한다', async () => {
        await cacheService.set(key, value)
        const cachedValue = await cacheService.get(key)

        expect(cachedValue).toEqual(value)
    })

    it('캐시에서 값을 삭제해야 한다', async () => {
        await cacheService.set(key, value)
        const initialValue = await cacheService.get(key)
        expect(initialValue).toEqual(value)

        await cacheService.delete(key)
        const deletedValue = await cacheService.get(key)
        expect(deletedValue).toBeNull()
    })

    it('만료 시간을 설정해야 한다', async () => {
        const ttl = 1000

        await cacheService.set(key, value, ttl)
        const initialValue = await cacheService.get(key)
        expect(initialValue).toEqual(value)

        await sleep(1000 + 100)
        const deletedValue = await cacheService.get(key)
        expect(deletedValue).toBeNull()
    })

    it('만료 시간이 음수이면 예외를 발생시켜야 한다', async () => {
        const wrongTTL = -100

        await expect(cacheService.set(key, value, wrongTTL)).rejects.toThrow(Error)
    })

    it('Lua 스크립트를 실행하여 키를 올바르게 설정해야 한다', async () => {
        const script = `return redis.call('SET', KEYS[1], ARGV[2])`
        const keys = ['key1']
        const args = ['value1']

        const result = await cacheService.executeScript(script, keys, args)
        expect(result).toBe('OK')

        const storedValue = await cacheService.get('key1')
        expect(storedValue).toBe('value1')
    })
})
