import { createTestContext, withTestId } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { CacheModule, CacheService, InjectCache } from '..'
import { getRedisConnectionToken, RedisModule } from '../../redis'

export type CacheServiceFixture = { cacheService: CacheService; teardown: () => Promise<void> }

@Injectable()
class TestInjectCacheService {
    constructor(@InjectCache() readonly _: CacheService) {}
}

export async function createCacheServiceFixture() {
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL }, 'name'),
            CacheModule.register({ prefix: withTestId('cache'), redisName: 'name' })
        ],
        providers: [TestInjectCacheService]
    })

    const cacheService = module.get(CacheService.getName())
    const redis = module.get(getRedisConnectionToken('name'))

    const teardown = async () => {
        await close()
        await redis.quit()
    }

    return { cacheService, teardown }
}
