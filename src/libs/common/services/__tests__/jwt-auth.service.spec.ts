import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { TestingModule } from '@nestjs/testing'
import { JwtAuthModule, JwtAuthService, sleep } from 'common'
import Redis from 'ioredis'
import { createTestingModule, getRedisTestConnection, withTestId } from 'testlib'

describe('JwtAuthService', () => {
    let module: TestingModule
    let jwtService: JwtAuthService
    let redis: Redis

    beforeEach(async () => {
        const { nodes, password } = getRedisTestConnection()

        module = await createTestingModule({
            imports: [
                RedisModule.forRoot(
                    { type: 'cluster', nodes, options: { redisOptions: { password } } },
                    'redis'
                ),
                JwtAuthModule.register({
                    name: 'jwtauth',
                    redisName: 'redis',
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

        jwtService = module.get(JwtAuthService.getToken('jwtauth'))
        redis = module.get(getRedisConnectionToken('redis'))
    })

    afterEach(async () => {
        await module?.close()
        await redis.quit()
    })

    it('인증 토큰을 생성해야 한다', async () => {
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

        it('유효한 refreshToken을 제공하면 새로운 인증 토큰을 반환해야 한다', async () => {
            const tokens = await jwtService.refreshAuthTokens(refreshToken)

            expect(tokens!.accessToken).not.toEqual(accessToken)
            expect(tokens!.refreshToken).not.toEqual(refreshToken)
        })

        it('잘못된 refreshToken을 제공하면 예외를 발생시켜야 한다', async () => {
            const promise = jwtService.refreshAuthTokens('invalid-token')
            expect(promise).rejects.toThrow()
        })

        it('만료된 refreshToken을 제공하면 예외를 발생시켜야 한다', async () => {
            await sleep(3500)

            const promise = jwtService.refreshAuthTokens(refreshToken)
            expect(promise).rejects.toThrow()
        })
    })
})
