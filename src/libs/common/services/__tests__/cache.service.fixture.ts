import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { Injectable } from '@nestjs/common'
import { CacheModule, CacheService, InjectCache } from 'common'
import { createTestingModule, getRedisTestConnection, withTestId } from 'testlib'

@Injectable()
class TestCacheService {
    constructor(@InjectCache() _service: CacheService) {}
}

export interface Fixture {
    teardown: () => Promise<void>
    cacheService: CacheService
}

export async function createFixture() {
    const { nodes, password } = getRedisTestConnection()

    const module = await createTestingModule({
        imports: [
            RedisModule.forRoot(
                { type: 'cluster', nodes, options: { redisOptions: { password } } },
                'name'
            ),
            CacheModule.register({ prefix: withTestId('cache'), redisName: 'name' })
        ],
        providers: [TestCacheService]
    })

    const cacheService = module.get(CacheService.getServiceName())
    const redis = module.get(getRedisConnectionToken('name'))

    const teardown = async () => {
        await module.close()
        await redis.quit()
    }

    return { teardown, cacheService }
}
