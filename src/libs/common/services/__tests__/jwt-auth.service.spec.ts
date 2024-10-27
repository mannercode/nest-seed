import { JwtModule } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis'
import { AUTH_CONFIG, CacheModule, CacheService, JwtAuthService } from '..'
import { sleep } from '../../utils'
import { createTestingModule } from 'testlib'

describe('JwtAuthService', () => {
    let module: TestingModule
    let jwtService: JwtAuthService
    let redisContainer: StartedRedisContainer
    let host: string
    let port: number

    beforeAll(async () => {
        redisContainer = await new RedisContainer().start()
        host = redisContainer.getHost()
        port = redisContainer.getMappedPort(6379)
    }, 60 * 1000)

    afterAll(async () => {
        await redisContainer.stop()
    })

    beforeEach(async () => {
        module = await createTestingModule({
            imports: [
                CacheModule.forRootAsync({ useFactory: () => ({ host, port }) }),
                JwtModule.register({ global: true })
            ],
            providers: [
                JwtAuthService,
                {
                    provide: AUTH_CONFIG,
                    useValue: {
                        accessSecret: 'accessSecret',
                        refreshSecret: 'refreshSecret',
                        accessTokenExpiration: '3s',
                        refreshTokenExpiration: '3s'
                    }
                }
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
