import { createTestContext, getRedisTestConnection, withTestId } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { getRedisConnectionToken, RedisModule } from '../../redis'
import { CacheModule, CacheService, InjectCache } from '../cache.service'

export type CacheServiceFixture = { cacheService: CacheService; teardown: () => Promise<void> }

@Injectable()
class TestInjectCacheService {
    constructor(@InjectCache() readonly _: CacheService) {}
}

export async function createCacheServiceFixture() {
    const { close, module } = await createTestContext({
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

    return { cacheService, teardown }
}
