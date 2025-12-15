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
        it('returns auth tokens for a valid payload', async () => {
            const payload = { userId: 'userId', email: 'email' }
            const tokens = await fix.jwtService.generateAuthTokens(payload)

            expect(tokens).toEqual({
                accessToken: expect.any(String),
                refreshToken: expect.any(String)
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

        it('returns new auth tokens for a valid refresh token', async () => {
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

            expect(tokens!.accessToken).not.toEqual(accessToken)
            expect(tokens!.refreshToken).not.toEqual(refreshToken)
        })

        it('throws jwt malformed for an invalid refresh token', async () => {
            const promise = fix.jwtService.refreshAuthTokens('invalid-token')
            await expect(promise).rejects.toThrow('jwt malformed')
        })

        it('throws jwt expired for an expired refresh token', async () => {
            await sleep(3500)

            const promise = fix.jwtService.refreshAuthTokens(refreshToken)
            await expect(promise).rejects.toThrow('jwt expired')
        })

        it('throws for a mismatched stored refresh token', async () => {
            jest.spyOn(fix.redis, 'get').mockResolvedValueOnce('unknown token')

            const promise = fix.jwtService.refreshAuthTokens(refreshToken)
            await expect(promise).rejects.toThrow('The provided refresh token is invalid')
        })
    })
})
