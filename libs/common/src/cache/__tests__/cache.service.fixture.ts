import { createTestContext, withTestId } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { CacheModule, CacheService, InjectCache } from '..'
import { RedisModule } from '../../redis'

export type CacheServiceFixture = {
    cacheA: CacheService
    cacheB: CacheService
    cacheService: CacheService
    teardown: () => Promise<void>
}

@Injectable()
class TestInjectCacheService {
    constructor(@InjectCache() readonly _: CacheService) {}
}

export async function createCacheServiceFixture() {
    // cacheA/cacheB는 앱의 실제 배치처럼 prefix는 같고 name만 다른 등록이다. 네임스페이스 격리 검증용.
    const prefix = withTestId('cache')

    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL }, 'name'),
            CacheModule.register({ prefix, redisName: 'name' }),
            CacheModule.register({ name: 'a', prefix, redisName: 'name' }),
            CacheModule.register({ name: 'b', prefix, redisName: 'name' })
        ],
        providers: [TestInjectCacheService]
    })

    const cacheService = module.get(CacheService.getName())
    const cacheA = module.get(CacheService.getName('a'))
    const cacheB = module.get(CacheService.getName('b'))

    // 연결 종료는 RedisConnectionRegistry가 모듈 destroy에서 책임진다.
    const teardown = async () => {
        await close()
    }

    return { cacheA, cacheB, cacheService, teardown }
}
