import { TestingModule } from '@nestjs/testing'
import { createRedisContainer, createTestingModule, RedisContainerContext } from 'testlib'
import { JwtAuthModule, JwtAuthService } from '..'
import { sleep } from '../../utils'

describe('JwtAuthService', () => {
    let module: TestingModule
    let jwtService: JwtAuthService
    let redisCtx: RedisContainerContext

    beforeAll(async () => {
        redisCtx = await createRedisContainer('single')
    }, 60 * 1000)

    afterAll(async () => {
        await redisCtx.close()
    })

    beforeEach(async () => {
        module = await createTestingModule({
            imports: [
                JwtAuthModule.forRootAsync(
                    {
                        useFactory: () => {
                            return {
                                type: 'single',
                                nodes: redisCtx.nodes,
                                password: redisCtx.password,
                                prefix: 'prefix',
                                accessSecret: 'accessSecret',
                                refreshSecret: 'refreshSecret',
                                accessTokenExpiration: '3s',
                                refreshTokenExpiration: '3s'
                            }
                        }
                    },
                    'JwtAuth'
                )
            ]
        })

        jwtService = module.get(JwtAuthService)
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
