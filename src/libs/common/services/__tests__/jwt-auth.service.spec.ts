import { sleep } from 'common'
import type { JwtAuthServiceFixture } from './jwt-auth.service.fixture'

describe('JwtAuthService', () => {
    let fix: JwtAuthServiceFixture

    beforeEach(async () => {
        const { createJwtAuthServiceFixture } = await import('./jwt-auth.service.fixture')
        fix = await createJwtAuthServiceFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

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

        describe('when the refreshToken is valid', () => {
            it('returns new auth tokens', async () => {
                const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

                expect(tokens!.accessToken).not.toEqual(accessToken)
                expect(tokens!.refreshToken).not.toEqual(refreshToken)
            })
        })

        describe('when the refreshToken is invalid', () => {
            it('throws an error', async () => {
                const promise = fix.jwtService.refreshAuthTokens('invalid-token')
                await expect(promise).rejects.toThrow('jwt malformed')
            })
        })

        describe('when the refreshToken is expired', () => {
            it('throws an error', async () => {
                await sleep(3500)

                const promise = fix.jwtService.refreshAuthTokens(refreshToken)
                await expect(promise).rejects.toThrow('jwt expired')
            })
        })

        describe('when the stored refreshToken differs', () => {
            it('throws an error', async () => {
                jest.spyOn(fix.redis, 'get').mockResolvedValueOnce('unknown token')

                const promise = fix.jwtService.refreshAuthTokens(refreshToken)
                await expect(promise).rejects.toThrow('The provided refresh token is invalid')
            })
        })
    })
})
