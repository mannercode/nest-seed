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
        describe('when the payload is valid', () => {
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

        describe('when the refresh token is valid', () => {
            it('returns new auth tokens', async () => {
                const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

                expect(tokens.accessToken).not.toEqual(accessToken)
                expect(tokens.refreshToken).not.toEqual(refreshToken)
            })
        })

        describe('when the refresh token is invalid', () => {
            it('throws jwt malformed', async () => {
                const promise = fix.jwtService.refreshAuthTokens('invalid-token')
                await expect(promise).rejects.toThrow('jwt malformed')
            })
        })

        describe('when the refresh token is expired', () => {
            it('throws jwt expired', async () => {
                await sleep(3500)

                const promise = fix.jwtService.refreshAuthTokens(refreshToken)
                await expect(promise).rejects.toThrow('jwt expired')
            })
        })

        describe('when the stored refresh token does not match', () => {
            it('throws', async () => {
                jest.spyOn(fix.redis, 'get').mockResolvedValueOnce('unknown token')

                const promise = fix.jwtService.refreshAuthTokens(refreshToken)
                await expect(promise).rejects.toThrow('The provided refresh token is invalid')
            })
        })
    })
})
