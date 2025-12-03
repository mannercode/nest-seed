import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { Injectable } from '@nestjs/common'
import { CacheModule, CacheService, InjectCache } from 'common'
import { createTestingModule, withTestId } from 'testlib'

@Injectable()
class TestInjectCacheService {
    constructor(@InjectCache() readonly _: CacheService) {}
}

export type CacheServiceFixture = { teardown: () => Promise<void>; cacheService: CacheService }

export async function createCacheServiceFixture() {
    const module = await createTestingModule({
        imports: [
            RedisModule.forRoot({ type: 'single', url: process.env.COMMONLIB_REDIS_URL }, 'name'),
            CacheModule.register({ prefix: withTestId('cache'), redisName: 'name' })
        ],
        providers: [TestInjectCacheService]
    })

    const cacheService = module.get(CacheService.getServiceName())
    const redis = module.get(getRedisConnectionToken('name'))

    async function teardown() {
        await module.close()
        await redis.quit()
    }

    return { teardown, cacheService }
}
