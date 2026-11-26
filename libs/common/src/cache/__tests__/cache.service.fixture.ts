import { createTestContext, withTestId } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { ConfigModule, registerAs } from '@nestjs/config'
import { getRedisConnectionToken, RedisModule, type RedisConnection } from '#common/redis'
import { CacheModule, CacheService, InjectCache } from '#common/cache'

export type CacheServiceFixture = {
    cacheA: CacheService
    cacheB: CacheService
    cacheService: CacheService
    redis: RedisConnection
    teardown: () => Promise<void>
}

@Injectable()
class TestInjectCacheService {
    constructor(@InjectCache() readonly _: CacheService) {}
}

export async function createCacheServiceFixture() {
    // cacheA/cacheB는 앱의 실제 배치처럼 prefix는 같고 name만 다른 등록이다. 네임스페이스 격리 검증용.
    const prefix = withTestId('cache')
    const redisConfig = registerAs('redis', () => ({
        type: 'single' as const,
        url: process.env.TESTLIB_REDIS_URL
    }))
    const cacheConfig = registerAs('cache', () => ({ prefix }))

    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRootAsync(redisConfig.asProvider(), 'name'),
            CacheModule.register({ prefix, redisName: 'name' }),
            CacheModule.register({
                imports: [ConfigModule.forFeature(cacheConfig)],
                inject: [cacheConfig.KEY],
                name: 'a',
                prefix: async (config: ReturnType<typeof cacheConfig>) => config.prefix,
                redisName: 'name'
            }),
            CacheModule.register({ name: 'b', prefix, redisName: 'name' })
        ],
        providers: [TestInjectCacheService]
    })

    const cacheService = module.get(CacheService.getName())
    const cacheA = module.get(CacheService.getName('a'))
    const cacheB = module.get(CacheService.getName('b'))
    const redis = module.get<RedisConnection>(getRedisConnectionToken('name'))

    const teardown = async () => {
        await close()
    }

    return { cacheA, cacheB, cacheService, redis, teardown }
}
