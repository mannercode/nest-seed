import { createTestContext, withTestId } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { CacheModule, CacheService, InjectCache } from '..'
import { RedisModule } from '../../redis'

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

    // 연결 종료는 RedisConnectionRegistry가 모듈 destroy에서 책임진다.
    const teardown = async () => {
        await close()
    }

    return { cacheService, teardown }
}
