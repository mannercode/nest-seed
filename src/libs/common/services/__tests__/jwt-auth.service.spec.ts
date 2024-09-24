import { CacheModule } from '@nestjs/cache-manager'
import { JwtModule } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import { CacheService, JwtAuthService } from '..'
import { sleep } from '../../utils'

describe('JwtAuthService', () => {
    let module: TestingModule
    let jwtService: JwtAuthService

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [CacheModule.register(), JwtModule.register({ global: true })],
            providers: [
                CacheService,
                JwtAuthService,
                {
                    provide: 'AuthConfig',
                    useValue: {
                        accessSecret: 'accessSecret',
                        refreshSecret: 'refreshSecret',
                        accessTokenExpiration: '3s',
                        refreshTokenExpiration: '3s'
                    }
                }
            ]
        }).compile()

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
