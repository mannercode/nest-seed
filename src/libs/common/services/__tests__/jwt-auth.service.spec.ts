import { sleep } from 'common'
import type { JwtAuthServiceFixture } from './jwt-auth.service.fixture'

describe('JwtAuthService', () => {
    let fix: JwtAuthServiceFixture

    beforeEach(async () => {
        const { createJwtAuthServiceFixture } = await import('./jwt-auth.service.fixture')
        fix = await createJwtAuthServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('generateAuthTokens', () => {
        // 페이로드가 유효할 때
        describe('when the payload is valid', () => {
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
            ;({ accessToken, refreshToken } = await fix.jwtService.generateAuthTokens(payload))
        })

        // 리프레시 토큰이 유효할 때
        describe('when the refresh token is valid', () => {
            // 새 인증 토큰을 반환한다
            it('returns new auth tokens', async () => {
                const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

                expect(tokens.accessToken).not.toEqual(accessToken)
                expect(tokens.refreshToken).not.toEqual(refreshToken)
            })
        })

        // 리프레시 토큰이 유효하지 않을 때
        describe('when the refresh token is invalid', () => {
            // jwt malformed을 던진다
            it('throws jwt malformed', async () => {
                const promise = fix.jwtService.refreshAuthTokens('invalid-token')
                await expect(promise).rejects.toThrow('jwt malformed')
            })
        })

        // 리프레시 토큰이 만료되었을 때
        describe('when the refresh token is expired', () => {
            // jwt expired를 던진다
            it('throws jwt expired', async () => {
                await sleep(3500)

                const promise = fix.jwtService.refreshAuthTokens(refreshToken)
                await expect(promise).rejects.toThrow('jwt expired')
            })
        })

        // 저장된 리프레시 토큰이 일치하지 않을 때
        describe('when the stored refresh token does not match', () => {
            beforeEach(() => {
                jest.spyOn(fix.redis, 'get').mockResolvedValueOnce('unknown token')
            })

            // 예외를 던진다
            it('throws', async () => {
                const promise = fix.jwtService.refreshAuthTokens(refreshToken)
                await expect(promise).rejects.toThrow('The provided refresh token is invalid')
            })
        })
    })
})
