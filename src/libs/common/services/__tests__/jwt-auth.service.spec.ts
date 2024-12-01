import { TestingModule } from '@nestjs/testing'
import {
    CacheModule,
    CacheService,
    generateShortId,
    JwtAuthModule,
    JwtAuthService,
    RedisModule,
    sleep
} from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection } from 'testlib'

describe('JwtAuthService', () => {
    let module: TestingModule
    let jwtService: JwtAuthService

    beforeEach(async () => {
        const redisCtx = getRedisTestConnection()

        module = await createTestingModule({
            imports: [
                RedisModule.forRootAsync({ useFactory: () => redisCtx }, 'redis'),
                CacheModule.forRootAsync(
                    {
                        useFactory: (redis: Redis) => ({ redis, prefix: generateShortId() }),
                        inject: [RedisModule.getToken('redis')]
                    },
                    'cache'
                ),
                JwtAuthModule.forRootAsync(
                    {
                        useFactory: (cache: CacheService) => {
                            return {
                                cache,
                                auth: {
                                    accessSecret: 'accessSecret',
                                    refreshSecret: 'refreshSecret',
                                    accessTokenExpiration: '3s',
                                    refreshTokenExpiration: '3s'
                                }
                            }
                        },
                        inject: [CacheService.getToken('cache')]
                    },
                    'JwtAuth'
                )
            ]
        })

        jwtService = module.get(JwtAuthService.getToken('JwtAuth'))
    })

    afterEach(async () => {
        if (module) await module.close()
    })

    it('generateAuthTokens', async () => {
        const tokens = await jwtService.generateAuthTokens('userId', 'email')

        expect(tokens).toEqual({
            accessToken: expect.any(String),
            refreshToken: expect.any(String)
        })
    })

    describe('refreshAuthTokens', () => {
        let accessToken: string
        let refreshToken: string

        beforeEach(async () => {
            const tokens = await jwtService.generateAuthTokens('userId', 'email')
            accessToken = tokens.accessToken
            refreshToken = tokens.refreshToken
        })

        it('Returns a new AuthTokens when providing a valid refreshToken', async () => {
            const tokens = await jwtService.refreshAuthTokens(refreshToken)

            expect(tokens!.accessToken).not.toEqual(accessToken)
            expect(tokens!.refreshToken).not.toEqual(refreshToken)
        })

        it('Returns null status when providing an incorrect refreshToken', async () => {
            const promise = jwtService.refreshAuthTokens('invalid-token')
            expect(promise).rejects.toThrow()
        })

        it('Returns null status when providing an expired refreshToken', async () => {
            await sleep(3500)

            const promise = jwtService.refreshAuthTokens(refreshToken)
            expect(promise).rejects.toThrow()
        })
    })
})
