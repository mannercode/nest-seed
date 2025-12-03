import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { Injectable } from '@nestjs/common'
import { InjectJwtAuth, JwtAuthModule, JwtAuthService } from 'common'
import Redis from 'ioredis'
import { createTestingModule, withTestId } from 'testlib'

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
    const module = await createTestingModule({
        imports: [
            RedisModule.forRoot({ type: 'single', url: process.env.REDIS_URL }),
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

    const jwtService = module.get(JwtAuthService.getServiceName())
    const redis = module.get(getRedisConnectionToken())

    async function teardown() {
        await module.close()
        await redis.quit()
    }

    return { teardown, jwtService, redis }
}
