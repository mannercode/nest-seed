import { Injectable } from '@nestjs/common'
import {
    getRedisConnectionToken,
    InjectJwtAuth,
    JwtAuthModule,
    JwtAuthService,
    RedisModule
} from 'common'
import Redis from 'ioredis'
import { createTestContext, getRedisTestConnection, withTestId } from 'testlib'

export type JwtAuthServiceFixture = {
    jwtService: JwtAuthService
    redis: Redis
    teardown: () => Promise<void>
}

@Injectable()
class TestInjectJwtAuthService {
    constructor(@InjectJwtAuth() readonly _: JwtAuthService) {}
}

export async function createJwtAuthServiceFixture() {
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'single', url: getRedisTestConnection() }),
            JwtAuthModule.register({
                prefix: withTestId('jwt-auth'),
                useFactory() {
                    return {
                        auth: {
                            accessSecret: 'accessSecret',
                            accessTokenTtlMs: 3000,
                            refreshSecret: 'refreshSecret',
                            refreshTokenTtlMs: 3000
                        }
                    }
                }
            })
        ],
        providers: [TestInjectJwtAuthService]
    })

    const jwtService = module.get(JwtAuthService.getName())
    const redis = module.get(getRedisConnectionToken())

    const teardown = async () => {
        await close()
        await redis.quit()
    }

    return { jwtService, redis, teardown }
}
