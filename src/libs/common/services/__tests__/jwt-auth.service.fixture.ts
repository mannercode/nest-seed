import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { JwtAuthModule, JwtAuthService } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection, withTestId } from 'testlib'

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
        ]
    })

    const jwtService = module.get(JwtAuthService.getServiceName())
    const redis = module.get(getRedisConnectionToken())

    const teardown = async () => {
        await module.close()
        await redis.quit()
    }

    return { teardown, jwtService, redis }
}
