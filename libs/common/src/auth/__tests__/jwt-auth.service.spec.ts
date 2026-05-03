import { JwtService } from '@nestjs/jwt'
import type { JwtAuthServiceFixture } from './jwt-auth.service.fixture'
import { sleep } from '../../utils'

describe('JwtAuthService', () => {
    let fix: JwtAuthServiceFixture

    beforeEach(async () => {
        const { createJwtAuthServiceFixture } = await import('./jwt-auth.service.fixture')
        fix = await createJwtAuthServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('generateAuthTokens', () => {
        // 페이로드가 유효할 때 인증 토큰을 반환한다
        it('returns auth tokens for a valid payload', async () => {
            const payload = { email: 'email', userId: 'userId' }
            const tokens = await fix.jwtService.generateAuthTokens(payload)

            expect(tokens).toEqual({
                accessToken: expect.any(String),
                refreshToken: expect.any(String)
            })
        })

        // 발급된 토큰에는 issuer 와 audience claim 이 들어간다
        it('embeds issuer and audience claims', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const tokens = await fix.jwtService.generateAuthTokens({ userId: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(tokens.accessToken)
            expect(decoded.iss).toBe(TEST_AUTH_ISSUER)
            expect(decoded.aud).toBe(TEST_AUTH_AUDIENCE)
        })

        // refresh 토큰에는 familyId / refreshTokenId 가 들어간다
        it('embeds familyId and refreshTokenId in the refresh token', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ userId: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)
            expect(decoded.familyId).toEqual(expect.any(String))
            expect(decoded.refreshTokenId).toEqual(expect.any(String))
        })
    })

    describe('refreshAuthTokens', () => {
        let accessToken: string
        let refreshToken: string

        beforeEach(async () => {
            const tokens = await fix.jwtService.generateAuthTokens({
                email: 'email',
                userId: 'userId'
            })
            accessToken = tokens.accessToken
            refreshToken = tokens.refreshToken
        })

        // 정상 회전: 새 인증 토큰을 반환한다
        it('returns new auth tokens when the refresh token is valid', async () => {
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

            expect(tokens.accessToken).not.toEqual(accessToken)
            expect(tokens.refreshToken).not.toEqual(refreshToken)
        })

        // 회전된 후 같은 family id 가 유지된다 (logout-all 같은 후속 작업이 가능하도록)
        it('keeps the same familyId after rotation', async () => {
            const before = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)
            const after = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)

            expect(after.familyId).toBe(before.familyId)
        })

        // 형식이 깨진 토큰은 jwt malformed
        it('throws jwt malformed for an invalid token', async () => {
            const promise = fix.jwtService.refreshAuthTokens('invalid-token')
            await expect(promise).rejects.toThrow('jwt malformed')
        })

        // 만료된 토큰은 jwt expired
        it('throws jwt expired when the refresh token is expired', async () => {
            await sleep(3500)
            const promise = fix.jwtService.refreshAuthTokens(refreshToken)
            await expect(promise).rejects.toThrow('jwt expired')
        })

        // 회전 직후 같은(이전) 토큰 재제출 → reuse 감지 → family 전체 폐기
        it('detects reuse: replaying a rotated token revokes the entire family', async () => {
            const rotated = await fix.jwtService.refreshAuthTokens(refreshToken)

            // 원본 refreshToken 다시 제출 — 이미 회전됐으므로 reuse 감지돼야 함
            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                /reuse detected/i
            )

            // family 가 폐기됐으므로 회전으로 발급된 새 refresh 토큰도 더 이상 유효하지 않다
            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        // payload 에 refreshTokenId / familyId 가 빠진 토큰은 invalid
        it('rejects a token whose payload is missing refreshTokenId or familyId', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const malformed = await new JwtService().signAsync(
                { userId: 'u1' }, // refreshTokenId / familyId 누락
                {
                    algorithm: 'HS256',
                    audience: TEST_AUTH_AUDIENCE,
                    issuer: TEST_AUTH_ISSUER,
                    secret: 'refreshSecret'
                }
            )
            await expect(fix.jwtService.refreshAuthTokens(malformed)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        // Redis 에 저장된 hash 가 변조됐거나 다른 토큰의 hash 면 invalid
        it('rejects when the stored hash does not match the supplied token', async () => {
            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokenId = decoded.refreshTokenId as string
            const familyId = decoded.familyId as string

            // Redis 에 들어있는 hash 만 다른 값으로 바꿔치기 (예: 동일 family 다른 token 으로 위장)
            await fix.redis.set(
                `${fix.jwtService.prefix}:{${familyId}}:token:${tokenId}`,
                JSON.stringify({ familyId, hash: 'bogus-hash' })
            )

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        // refresh 토큰은 Redis 에 hash 형태로 저장된다 (plaintext 미저장)
        it('stores refresh tokens as SHA-256 hashes in Redis', async () => {
            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokenId = decoded.refreshTokenId as string
            const familyId = decoded.familyId as string
            const stored = await fix.redis.get(
                `${fix.jwtService.prefix}:{${familyId}}:token:${tokenId}`
            )
            expect(stored).not.toBeNull()
            const parsed = JSON.parse(stored ?? '') as { hash: string; familyId: string }
            // 64-char hex digest
            expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/)
            // 원본 토큰이 그대로 들어가 있으면 안 됨
            expect(stored).not.toContain(refreshToken)
        })
    })

    describe('revokeRefreshToken (logout)', () => {
        // 폐기된 토큰으로는 더 이상 회전 불가
        it('makes the token unusable for refresh after revocation', async () => {
            const { refreshToken } = await fix.jwtService.generateAuthTokens({ userId: 'u1' })
            await fix.jwtService.revokeRefreshToken(refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        // 잘못된 / 만료된 토큰을 폐기 시도해도 throw 하지 않는다 (best-effort)
        it('silently no-ops on a malformed token', async () => {
            await expect(fix.jwtService.revokeRefreshToken('garbage')).resolves.toBeUndefined()
        })

        // payload 에 familyId 가 없는 잘 서명된 토큰은 silent no-op
        it('silently no-ops when the parsed payload has no familyId', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const noFamily = await new JwtService().signAsync(
                { userId: 'u1' },
                {
                    algorithm: 'HS256',
                    audience: TEST_AUTH_AUDIENCE,
                    issuer: TEST_AUTH_ISSUER,
                    secret: 'refreshSecret'
                }
            )
            await expect(fix.jwtService.revokeRefreshToken(noFamily)).resolves.toBeUndefined()
        })
    })

    describe('algorithm pinning', () => {
        // 다른 algorithm 으로 서명된 토큰은 거부된다
        it('rejects a token signed with a non-pinned algorithm', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const sneaky = await new JwtService().signAsync(
                { familyId: 'x', refreshTokenId: 'y', userId: 'u1' },
                {
                    algorithm: 'none' as any,
                    audience: TEST_AUTH_AUDIENCE,
                    issuer: TEST_AUTH_ISSUER,
                    secret: 'refreshSecret'
                }
            )
            await expect(fix.jwtService.refreshAuthTokens(sneaky)).rejects.toThrow()
        })
    })

    describe('issuer / audience validation', () => {
        // issuer 가 다른 토큰은 거부된다
        it('rejects a token with a different issuer', async () => {
            const { TEST_AUTH_AUDIENCE } = await import('./jwt-auth.service.fixture')
            const wrong = await new JwtService().signAsync(
                { familyId: 'x', refreshTokenId: 'y', userId: 'u1' },
                {
                    algorithm: 'HS256',
                    audience: TEST_AUTH_AUDIENCE,
                    issuer: 'other-issuer',
                    secret: 'refreshSecret'
                }
            )
            await expect(fix.jwtService.refreshAuthTokens(wrong)).rejects.toThrow()
        })

        // audience 가 다른 토큰은 거부된다
        it('rejects a token with a different audience', async () => {
            const { TEST_AUTH_ISSUER } = await import('./jwt-auth.service.fixture')
            const wrong = await new JwtService().signAsync(
                { familyId: 'x', refreshTokenId: 'y', userId: 'u1' },
                {
                    algorithm: 'HS256',
                    audience: 'other-audience',
                    issuer: TEST_AUTH_ISSUER,
                    secret: 'refreshSecret'
                }
            )
            await expect(fix.jwtService.refreshAuthTokens(wrong)).rejects.toThrow()
        })
    })
})
