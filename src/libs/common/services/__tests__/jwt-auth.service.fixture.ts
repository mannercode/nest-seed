import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { Injectable } from '@nestjs/common'
import { InjectJwtAuth, JwtAuthModule, JwtAuthService } from 'common'
import Redis from 'ioredis'
import { createTestContext, getRedisTestConnection, withTestId } from 'testlib'

@Injectable()
class TestInjectJwtAuthService {
    constructor(@InjectJwtAuth() readonly _: JwtAuthService) {}
}

export type JwtAuthServiceFixture = {
    teardown: () => Promise<void>
    jwtService: JwtAuthService
    redis: Redis
}

export async function createJwtAuthServiceFixture() {
    const { module, close } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'single', url: getRedisTestConnection() }),
            JwtAuthModule.register({
                prefix: withTestId('jwt-auth'),
                useFactory() {
                    return {
                        auth: {
                            accessSecret: 'accessSecret',
                            refreshSecret: 'refreshSecret',
                            accessTokenTtlMs: 3000,
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

    return { teardown, jwtService, redis }
}
