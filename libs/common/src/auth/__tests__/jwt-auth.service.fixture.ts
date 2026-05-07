import { createTestContext, withTestId } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { getRedisTestConnection } from '../../infra-connections'
import { getRedisConnectionToken, RedisModule } from '../../redis'
import {
    InjectJwtAuth,
    JwtAuthModule,
    JwtAuthService,
    OnSecurityEvent,
    SecurityEvent
} from '../jwt-auth.service'

export const TEST_AUTH_AUDIENCE = 'test-audience'
export const TEST_AUTH_ISSUER = 'test-issuer'

export type JwtAuthServiceFixture = {
    events: SecurityEvent[]
    jwtService: JwtAuthService
    redis: Redis
    teardown: () => Promise<void>
}

@Injectable()
class TestInjectJwtAuthService {
    constructor(@InjectJwtAuth() readonly _: JwtAuthService) {}
}

export async function createJwtAuthServiceFixture() {
    const events: SecurityEvent[] = []
    const onEvent: OnSecurityEvent = (event) => {
        events.push(event)
    }

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
                            audience: TEST_AUTH_AUDIENCE,
                            issuer: TEST_AUTH_ISSUER,
                            refreshSecret: 'refreshSecret',
                            refreshTokenTtlMs: 3000
                        },
                        onEvent
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

    return { events, jwtService, redis, teardown }
}
