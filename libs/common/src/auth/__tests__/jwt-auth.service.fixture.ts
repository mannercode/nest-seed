import { createTestContext, withTestId } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { getRedisConnectionToken, RedisModule } from '../../redis/index.js'
import { InjectJwtAuth, JwtAuthModule, JwtAuthService } from '../index.js'

export const TEST_AUTH_AUDIENCE = 'test-audience'
export const TEST_AUTH_ISSUER = 'test-issuer'

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
            RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL }),
            JwtAuthModule.register({
                prefix: async () => withTestId('jwt-auth'),
                useFactory() {
                    return {
                        auth: {
                            accessSecret: 'accessSecret',
                            accessTokenTtlMs: 3000,
                            audience: TEST_AUTH_AUDIENCE,
                            issuer: TEST_AUTH_ISSUER,
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
    }

    return { jwtService, redis, teardown }
}

export async function createJwtAuthServiceFixtureWithShortTtl() {
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL }),
            JwtAuthModule.register({
                prefix: withTestId('jwt-auth-short'),
                useFactory() {
                    return {
                        auth: {
                            accessSecret: 'accessSecret',
                            // 1초 미만 TTL은 내림 후 0초가 되어 즉시 만료된다.
                            accessTokenTtlMs: 500,
                            audience: TEST_AUTH_AUDIENCE,
                            issuer: TEST_AUTH_ISSUER,
                            refreshSecret: 'refreshSecret',
                            refreshTokenTtlMs: 3000
                        }
                    }
                }
            })
        ]
    })

    const jwtService = module.get(JwtAuthService.getName())
    const redis = module.get(getRedisConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { jwtService, redis, teardown }
}
