import { createTestContext, getRedisTestConnection, withTestId } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { getRedisConnectionToken, RedisModule } from '../../redis'
import { InjectJwtAuth, JwtAuthModule, JwtAuthService } from '../jwt-auth.service'

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
