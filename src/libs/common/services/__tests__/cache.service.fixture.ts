import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { Injectable } from '@nestjs/common'
import { CacheModule, CacheService, InjectCache } from 'common'
import { createTestContext, getRedisTestConnection, withTestId } from 'testlib'

@Injectable()
class TestInjectCacheService {
    constructor(@InjectCache() readonly _: CacheService) {}
}

export type CacheServiceFixture = { teardown: () => Promise<void>; cacheService: CacheService }

export async function createCacheServiceFixture() {
    const { module, close } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'single', url: getRedisTestConnection() }, 'name'),
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

    return { teardown, cacheService }
}
