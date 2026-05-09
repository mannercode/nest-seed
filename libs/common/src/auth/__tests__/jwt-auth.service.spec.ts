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
        it('페이로드가 유효할 때 인증 토큰을 반환한다', async () => {
            const payload = { email: 'email', sub: 'u1' }
            const tokens = await fix.jwtService.generateAuthTokens(payload)

            expect(tokens).toEqual({
                accessToken: expect.any(String),
                refreshToken: expect.any(String)
            })
        })

        it('발급된 토큰에는 issuer 와 audience claim 이 들어간다', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(tokens.accessToken)
            expect(decoded.iss).toBe(TEST_AUTH_ISSUER)
            expect(decoded.aud).toBe(TEST_AUTH_AUDIENCE)
        })

        it('refresh 토큰에는 familyId / refreshTokenId 가 들어간다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)
            expect(decoded.familyId).toEqual(expect.any(String))
            expect(decoded.refreshTokenId).toEqual(expect.any(String))
        })
    })

    describe('refreshAuthTokens', () => {
        let accessToken: string
        let refreshToken: string

        beforeEach(async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ email: 'email', sub: 'u1' })
            accessToken = tokens.accessToken
            refreshToken = tokens.refreshToken
        })

        it('정상 회전: 새 인증 토큰을 반환한다', async () => {
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

            expect(tokens.accessToken).not.toEqual(accessToken)
            expect(tokens.refreshToken).not.toEqual(refreshToken)
        })

        it('회전된 후 같은 family id 가 유지된다 (logout-all 같은 후속 작업이 가능하도록)', async () => {
            const before = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)
            const after = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)

            expect(after.familyId).toBe(before.familyId)
        })

        it('형식이 깨진 토큰은 jwt malformed', async () => {
            const promise = fix.jwtService.refreshAuthTokens('invalid-token')
            await expect(promise).rejects.toThrow('jwt malformed')
        })

        it('만료된 토큰은 jwt expired', async () => {
            await sleep(3500)
            const promise = fix.jwtService.refreshAuthTokens(refreshToken)
            await expect(promise).rejects.toThrow('jwt expired')
        })

        it('회전 직후 같은(이전) 토큰 재제출 → reuse 감지 → family 전체 폐기', async () => {
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

        it('payload 에 refreshTokenId / familyId 가 빠진 토큰은 invalid', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const malformed = await new JwtService().signAsync(
                { sub: 'u1' }, // refreshTokenId / familyId 누락
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

        it('Redis 에 저장된 hash 가 변조됐거나 다른 토큰의 hash 면 invalid', async () => {
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

        // 동시 회전 race: atomic DEL count 로 정확히 1명만 새 토큰을 받고,
        // 나머지는 이미 회전된 토큰을 다시 제출한 것과 구별 불가하므로 reuse
        // 감지로 401 을 받는다. (family 폐기 여부는 winner storeToken 과
        // loser revokeFamily 의 미세한 timing 에 좌우되므로 단언하지 않는다.
        // 핵심 invariant 는 "동시에 유효한 새 토큰이 둘 이상 생기지 않는다".)
        it('동시 refresh 를 직렬화한다: 정확히 하나만 성공하고 나머지는 reuse 감지로 실패한다', async () => {
            type Attempt =
                | { ok: true; tokens: { accessToken: string; refreshToken: string } }
                | { ok: false; err: Error }

            const attempts: Attempt[] = await Promise.all(
                Array.from({ length: 10 }, async () => {
                    try {
                        return {
                            ok: true,
                            tokens: await fix.jwtService.refreshAuthTokens(refreshToken)
                        } as const
                    } catch (err) {
                        return { ok: false, err: err as Error } as const
                    }
                })
            )

            const winners = attempts.filter((a) => a.ok)
            const losers = attempts.filter((a): a is Extract<Attempt, { ok: false }> => !a.ok)
            expect(winners).toHaveLength(1)
            expect(losers).toHaveLength(9)
            losers.forEach((l) => {
                expect(l.err.message).toMatch(/reuse detected/i)
            })
        })

        it('refresh 토큰은 Redis 에 SHA-256 hash 형태로 저장된다 (plaintext 미저장)', async () => {
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
        it('폐기된 토큰으로는 더 이상 회전 불가', async () => {
            const { refreshToken } = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.revokeRefreshToken(refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('잘못된 / 만료된 토큰을 폐기 시도해도 throw 하지 않는다 (best-effort)', async () => {
            await expect(fix.jwtService.revokeRefreshToken('garbage')).resolves.toBeUndefined()
        })

        it('payload 에 familyId 가 없는 잘 서명된 토큰은 silent no-op', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const noFamily = await new JwtService().signAsync(
                { sub: 'u1' },
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

    describe('revokeAllForUser', () => {
        it('한 사용자의 모든 family 가 폐기된다 (다른 사용자는 영향 없음)', async () => {
            // u1 두 디바이스 + u2 한 디바이스
            const u1a = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const u1b = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const u2 = await fix.jwtService.generateAuthTokens({ sub: 'u2' })

            await fix.jwtService.revokeAllForUser('u1')

            // u1 양쪽 모두 더 이상 refresh 불가
            await expect(fix.jwtService.refreshAuthTokens(u1a.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
            await expect(fix.jwtService.refreshAuthTokens(u1b.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )

            // u2 는 영향 없음
            const refreshed = await fix.jwtService.refreshAuthTokens(u2.refreshToken)
            expect(refreshed.refreshToken).toEqual(expect.any(String))
        })

        it('활성 세션이 없는 사용자에게 호출해도 no-op', async () => {
            await expect(fix.jwtService.revokeAllForUser('nobody')).resolves.toBeUndefined()
        })

        it('회전 후에도 같은 family 가 user index 에 유지되어 logout-all 이 동작한다', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const rotated = await fix.jwtService.refreshAuthTokens(initial.refreshToken)

            await fix.jwtService.revokeAllForUser('u1')

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })
    })

    describe('onSecurityEvent hook', () => {
        it('정상 발급 시 token.issued 이벤트가 발화된다', async () => {
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const issued = fix.events.find((e) => e.type === 'token.issued')
            expect(issued).toMatchObject({
                type: 'token.issued',
                userId: 'u1',
                familyId: expect.any(String),
                tokenId: expect.any(String)
            })
        })

        it('정상 회전 시 token.refreshed 이벤트가 발화된다', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            fix.events.length = 0
            await fix.jwtService.refreshAuthTokens(initial.refreshToken)

            const refreshed = fix.events.find((e) => e.type === 'token.refreshed')
            expect(refreshed).toMatchObject({
                type: 'token.refreshed',
                userId: 'u1',
                oldTokenId: expect.any(String),
                newTokenId: expect.any(String)
            })
        })

        it('reuse 감지 시 token.reuse_detected + family.revoked(reason: reuse)', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.refreshAuthTokens(initial.refreshToken)
            fix.events.length = 0
            await expect(fix.jwtService.refreshAuthTokens(initial.refreshToken)).rejects.toThrow()

            expect(fix.events.find((e) => e.type === 'token.reuse_detected')).toMatchObject({
                userId: 'u1'
            })
            expect(fix.events.find((e) => e.type === 'family.revoked')).toMatchObject({
                reason: 'reuse',
                userId: 'u1'
            })
        })

        it('일반 logout 시 family.revoked(reason: logout) 발화', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            fix.events.length = 0
            await fix.jwtService.revokeRefreshToken(initial.refreshToken)

            expect(fix.events.find((e) => e.type === 'family.revoked')).toMatchObject({
                reason: 'logout',
                userId: 'u1'
            })
        })

        it('logout-all 시 family.revoked(reason: logout_all) 가 family 마다 발화된다', async () => {
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            fix.events.length = 0

            await fix.jwtService.revokeAllForUser('u1')

            const revokes = fix.events.filter(
                (e) => e.type === 'family.revoked' && e.reason === 'logout_all'
            )
            expect(revokes.length).toBe(2)
        })

        it('검증 실패 시 verify.failed 발화', async () => {
            await expect(fix.jwtService.refreshAuthTokens('garbage')).rejects.toThrow()
            expect(fix.events.find((e) => e.type === 'verify.failed')).toMatchObject({
                type: 'verify.failed',
                reason: expect.any(String)
            })
        })

        it('logout 시 verify.failed 는 발화하지 않는다 (best-effort)', async () => {
            await fix.jwtService.revokeRefreshToken('garbage')
            expect(fix.events.find((e) => e.type === 'verify.failed')).toBeUndefined()
        })

        it('context 가 이벤트에 그대로 전파된다', async () => {
            const ctx = { ip: '1.2.3.4', userAgent: 'jest', source: 'login' }
            await fix.jwtService.generateAuthTokens({ sub: 'u1' }, ctx)

            const issued = fix.events.find((e) => e.type === 'token.issued')
            expect(issued?.context).toEqual(ctx)
        })

        it('onEvent 가 등록 안 된 인스턴스는 emit 호출돼도 조용히 no-op', async () => {
            // onEvent 를 일시적으로 제거해 hook-less 인스턴스를 시뮬레이션
            const original = (fix.jwtService as any).onEvent
            ;(fix.jwtService as any).onEvent = undefined
            try {
                await expect(
                    fix.jwtService.generateAuthTokens({ sub: 'u1' })
                ).resolves.toBeDefined()
            } finally {
                ;(fix.jwtService as any).onEvent = original
            }
        })

        it('훅이 throw 해도 인증은 통과한다', async () => {
            // jwtService 에 문제가 되는 hook 으로 직접 교체
            const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {})
            const original = (fix.jwtService as any).onEvent
            ;(fix.jwtService as any).onEvent = () => {
                throw new Error('boom')
            }
            try {
                await expect(
                    fix.jwtService.generateAuthTokens({ sub: 'u1' })
                ).resolves.toBeDefined()
            } finally {
                ;(fix.jwtService as any).onEvent = original
                consoleErr.mockRestore()
            }
        })
    })

    describe('payload without a user id', () => {
        // sub 가 없는 payload: per-user index 가 만들어지지 않고도 모든 흐름이 동작해야 한다
        // (storeToken 의 if(userId) false 분기, revokeFamily 의 if(userId) false 분기)
        it('sub 가 없는 payload 도 issue/refresh/revoke 가 정상 동작한다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ email: 'no-sub@x' })

            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)
            expect(rotated.refreshToken).not.toEqual(tokens.refreshToken)

            await fix.jwtService.revokeRefreshToken(rotated.refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('sub 가 string 이 아니면 userId 로 간주되지 않는다 (typeof string check)', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 12345 })

            // user index 미생성 → revokeAllForUser 가 그 값으로 호출돼도 영향 없음
            await fix.jwtService.revokeAllForUser('12345')

            // 일반 회전은 정상
            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)
            expect(rotated.refreshToken).toEqual(expect.any(String))
        })

        it('sub 없는 토큰으로 reuse 감지 시 revokeFamily 가 userId=undefined 로 호출된다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ email: 'no-sub@x' })
            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(tokens.refreshToken)).rejects.toThrow(
                /reuse detected/i
            )

            // family 가 폐기됐으니 회전된 새 토큰도 더 이상 유효하지 않다
            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })
    })

    describe('algorithm pinning', () => {
        it('다른 algorithm 으로 서명된 토큰은 거부된다', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const sneaky = await new JwtService().signAsync(
                { familyId: 'x', refreshTokenId: 'y', sub: 'u1' },
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
        it('issuer 가 다른 토큰은 거부된다', async () => {
            const { TEST_AUTH_AUDIENCE } = await import('./jwt-auth.service.fixture')
            const wrong = await new JwtService().signAsync(
                { familyId: 'x', refreshTokenId: 'y', sub: 'u1' },
                {
                    algorithm: 'HS256',
                    audience: TEST_AUTH_AUDIENCE,
                    issuer: 'other-issuer',
                    secret: 'refreshSecret'
                }
            )
            await expect(fix.jwtService.refreshAuthTokens(wrong)).rejects.toThrow()
        })

        it('audience 가 다른 토큰은 거부된다', async () => {
            const { TEST_AUTH_ISSUER } = await import('./jwt-auth.service.fixture')
            const wrong = await new JwtService().signAsync(
                { familyId: 'x', refreshTokenId: 'y', sub: 'u1' },
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
