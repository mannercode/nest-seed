import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { Injectable } from '@nestjs/common'
import { InjectJwtAuth, JwtAuthModule, JwtAuthService } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection, withTestId } from 'testlib'

@Injectable()
class TestInjectJwtAuthService {
    constructor(@InjectJwtAuth() _: JwtAuthService) {}
}

export interface Fixture {
    teardown: () => Promise<void>
    jwtService: JwtAuthService
    redis: Redis
}

export async function createFixture() {
    const { nodes, password } = getRedisTestConnection()

    const module = await createTestingModule({
        imports: [
            RedisModule.forRoot({
                type: 'cluster',
                nodes,
                options: { redisOptions: { password } }
            }),
            JwtAuthModule.register({
                prefix: withTestId('jwt-auth'),
                useFactory: () => ({
                    auth: {
                        accessSecret: 'accessSecret',
                        refreshSecret: 'refreshSecret',
                        accessTokenTtlMs: 3000,
                        refreshTokenTtlMs: 3000
                    }
                })
            })
        ],
        providers: [TestInjectJwtAuthService]
    })

    const jwtService = module.get(JwtAuthService.getServiceName())
    const redis = module.get(getRedisConnectionToken())

    const teardown = async () => {
        await module.close()
        await redis.quit()
    }

    return { teardown, jwtService, redis }
}
