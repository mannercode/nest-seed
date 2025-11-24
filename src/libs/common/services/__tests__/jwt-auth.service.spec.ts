import { sleep } from 'common'
import type { Fixture } from './jwt-auth.service.fixture'

describe('JwtAuthService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./jwt-auth.service.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('generateAuthTokens', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 인증 토큰을 반환한다
            it('returns auth tokens', async () => {
                const payload = { userId: 'userId', email: 'email' }
                const tokens = await fix.jwtService.generateAuthTokens(payload)

                expect(tokens).toEqual({
                    accessToken: expect.any(String),
                    refreshToken: expect.any(String)
                })
            })
        })
    })

    describe('refreshAuthTokens', () => {
        let accessToken: string
        let refreshToken: string

        beforeEach(async () => {
            const payload = { userId: 'userId', email: 'email' }
            const tokens = await fix.jwtService.generateAuthTokens(payload)
            accessToken = tokens.accessToken
            refreshToken = tokens.refreshToken
        })

        // 유효한 refreshToken인 경우
        describe('when refreshToken is valid', () => {
            // 새로운 인증 토큰을 반환한다
            it('returns new auth tokens', async () => {
                const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

                expect(tokens!.accessToken).not.toEqual(accessToken)
                expect(tokens!.refreshToken).not.toEqual(refreshToken)
            })
        })

        // refreshToken이 잘못된 경우
        describe('when refreshToken is invalid', () => {
            // 예외를 던진다
            it('throws an error', async () => {
                const promise = fix.jwtService.refreshAuthTokens('invalid-token')
                await expect(promise).rejects.toThrow('jwt malformed')
            })
        })

        // refreshToken이 만료된 경우
        describe('when refreshToken is expired', () => {
            // 예외를 던진다
            it('throws an error', async () => {
                await sleep(3500)

                const promise = fix.jwtService.refreshAuthTokens(refreshToken)
                await expect(promise).rejects.toThrow('jwt expired')
            })
        })

        // 저장된 refreshToken과 다른 경우
        describe('when stored refreshToken differs', () => {
            // 예외를 던진다
            it('throws an error', async () => {
                jest.spyOn(fix.redis, 'get').mockResolvedValueOnce('unknown token')

                const promise = fix.jwtService.refreshAuthTokens(refreshToken)
                await expect(promise).rejects.toThrow('The provided refresh token is invalid')
            })
        })
    })
})
