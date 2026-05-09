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
        it('인증 토큰을 발급한다', async () => {
            const payload = { email: 'email', sub: 'u1' }
            const tokens = await fix.jwtService.generateAuthTokens(payload)

            expect(tokens).toEqual({
                accessToken: expect.any(String),
                refreshToken: expect.any(String)
            })
        })

        it('토큰에 issuer와 audience가 포함된다', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(tokens.accessToken)
            expect(decoded.iss).toBe(TEST_AUTH_ISSUER)
            expect(decoded.aud).toBe(TEST_AUTH_AUDIENCE)
        })

        it('refresh 토큰에 familyId와 refreshTokenId가 포함된다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)
            expect(decoded.familyId).toEqual(expect.any(String))
            expect(decoded.refreshTokenId).toEqual(expect.any(String))
        })

        it.todo('access 토큰 TTL이 1초 미만이면 발급 즉시 만료된다')
    })

    describe('refreshAuthTokens', () => {
        let accessToken: string
        let refreshToken: string

        beforeEach(async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ email: 'email', sub: 'u1' })
            accessToken = tokens.accessToken
            refreshToken = tokens.refreshToken
        })

        it('회전하면 새 인증 토큰을 반환한다', async () => {
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

            expect(tokens.accessToken).not.toEqual(accessToken)
            expect(tokens.refreshToken).not.toEqual(refreshToken)
        })

        it('회전 후에도 familyId가 유지된다', async () => {
            const before = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)
            const after = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)

            expect(after.familyId).toBe(before.familyId)
        })

        it('형식이 깨진 토큰은 jwt malformed 예외를 던진다', async () => {
            const promise = fix.jwtService.refreshAuthTokens('invalid-token')
            await expect(promise).rejects.toThrow('jwt malformed')
        })

        it('만료된 토큰은 jwt expired 예외를 던진다', async () => {
            // fixture TTL(3000ms)보다 길게 대기하여 부하 환경에서도 만료 보장.
            await sleep(4000)
            const promise = fix.jwtService.refreshAuthTokens(refreshToken)
            await expect(promise).rejects.toThrow('jwt expired')
        })

        it('이미 회전된 토큰을 다시 제출하면 재사용을 감지하고 family 전체를 폐기한다', async () => {
            const rotated = await fix.jwtService.refreshAuthTokens(refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                /reuse detected/i
            )

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('refreshTokenId나 familyId가 없는 토큰은 거부한다', async () => {
            const { TEST_AUTH_AUDIENCE, TEST_AUTH_ISSUER } =
                await import('./jwt-auth.service.fixture')
            const malformed = await new JwtService().signAsync(
                { sub: 'u1' },
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

        // 저장 형식을 직접 단언한다. Redis 키 스키마가 바뀌면 이 테스트도 갱신해야 한다.
        it('Redis에 저장된 해시가 변조되면 거부한다', async () => {
            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokenId = decoded.refreshTokenId as string
            const familyId = decoded.familyId as string

            await fix.redis.set(
                `${fix.jwtService.prefix}:{${familyId}}:token:${tokenId}`,
                JSON.stringify({ familyId, hash: 'bogus-hash' })
            )

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        // 동시 회전: atomic DEL count로 정확히 1명만 새 토큰을 받고, 나머지는
        // 이미 회전된 토큰을 다시 제출한 것과 구별 불가하므로 재사용 감지로 401을 받는다.
        // family 폐기 여부는 winner의 storeToken과 loser의 revokeFamily 사이 타이밍에
        // 좌우되므로 단언하지 않는다. 핵심 불변식은 "동시에 유효한 새 토큰이 둘 이상 생기지 않는다".
        it('동시 회전 시 하나만 성공하고 나머지는 재사용 감지로 실패한다', async () => {
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

        // 저장 형식을 직접 단언한다. Redis 키 스키마가 바뀌면 이 테스트도 갱신해야 한다.
        it('refresh 토큰은 SHA-256 해시로 저장되며 평문은 저장되지 않는다', async () => {
            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokenId = decoded.refreshTokenId as string
            const familyId = decoded.familyId as string
            const stored = await fix.redis.get(
                `${fix.jwtService.prefix}:{${familyId}}:token:${tokenId}`
            )
            expect(stored).not.toBeNull()
            const parsed = JSON.parse(stored ?? '') as { hash: string; familyId: string }
            expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/)
            expect(stored).not.toContain(refreshToken)
        })

        it.todo('Redis가 손상된 JSON을 반환해도 안전하게 처리된다')

        it.todo('token-key와 family-key가 같은 해시 태그를 공유하여 Cluster의 같은 슬롯에 배치된다')

        it.todo('회전된 새 토큰에는 이전 토큰의 표준 JWT claim이 복사되지 않는다')

        describe('트랜잭션이 중단되어 multi().exec()가 null을 반환할 때', () => {
            it.todo('family를 폐기하지 않고 예외를 그대로 던진다')
            it.todo('새 토큰을 발급하지 않는다')
        })

        describe('트랜잭션 실패', () => {
            it.todo('storeToken의 트랜잭션이 실패하면 예외를 그대로 전파한다')
            it.todo('revokeFamily의 트랜잭션이 실패해도 family가 부분 정리 상태로 남지 않는다')
        })
    })

    describe('revokeRefreshToken (logout)', () => {
        it('폐기된 토큰으로는 더 이상 회전할 수 없다', async () => {
            const { refreshToken } = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.revokeRefreshToken(refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('잘못되거나 만료된 토큰을 폐기해도 예외를 던지지 않는다', async () => {
            await expect(fix.jwtService.revokeRefreshToken('garbage')).resolves.toBeUndefined()
        })

        it('familyId가 없는 토큰을 폐기해도 아무 일도 일어나지 않는다', async () => {
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

        it.todo('이벤트 발화가 실패해도 후속 토큰 발급과 검증은 정상 동작한다')
    })

    describe('revokeAllForUser', () => {
        it('한 사용자의 모든 family를 폐기하고 다른 사용자는 영향받지 않는다', async () => {
            const u1a = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const u1b = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const u2 = await fix.jwtService.generateAuthTokens({ sub: 'u2' })

            await fix.jwtService.revokeAllForUser('u1')

            await expect(fix.jwtService.refreshAuthTokens(u1a.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
            await expect(fix.jwtService.refreshAuthTokens(u1b.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )

            const refreshed = await fix.jwtService.refreshAuthTokens(u2.refreshToken)
            expect(refreshed.refreshToken).toEqual(expect.any(String))
        })

        it('활성 세션이 없는 사용자에게 호출해도 아무 일도 일어나지 않는다', async () => {
            await expect(fix.jwtService.revokeAllForUser('nobody')).resolves.toBeUndefined()
        })

        it('회전 후에도 같은 family가 사용자 인덱스에 유지되어 전체 로그아웃이 동작한다', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const rotated = await fix.jwtService.refreshAuthTokens(initial.refreshToken)

            await fix.jwtService.revokeAllForUser('u1')

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })
    })

    describe('onSecurityEvent 훅', () => {
        it('토큰 발급 시 token.issued 이벤트가 발화된다', async () => {
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const issued = fix.events.find((e) => e.type === 'token.issued')
            expect(issued).toMatchObject({
                type: 'token.issued',
                userId: 'u1',
                familyId: expect.any(String),
                tokenId: expect.any(String)
            })
        })

        it('토큰 회전 시 token.refreshed 이벤트가 발화된다', async () => {
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

        it('재사용 감지 시 token.reuse_detected와 reason=reuse의 family.revoked 이벤트가 발화된다', async () => {
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

        it('logout 시 reason=logout의 family.revoked 이벤트가 발화된다', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            fix.events.length = 0
            await fix.jwtService.revokeRefreshToken(initial.refreshToken)

            expect(fix.events.find((e) => e.type === 'family.revoked')).toMatchObject({
                reason: 'logout',
                userId: 'u1'
            })
        })

        it('전체 로그아웃 시 family마다 reason=logout_all의 family.revoked 이벤트가 발화된다', async () => {
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            fix.events.length = 0

            await fix.jwtService.revokeAllForUser('u1')

            const revokes = fix.events.filter(
                (e) => e.type === 'family.revoked' && e.reason === 'logout_all'
            )
            expect(revokes.length).toBe(2)
        })

        it('검증 실패 시 verify.failed 이벤트가 발화된다', async () => {
            await expect(fix.jwtService.refreshAuthTokens('garbage')).rejects.toThrow()
            expect(fix.events.find((e) => e.type === 'verify.failed')).toMatchObject({
                type: 'verify.failed',
                reason: expect.any(String)
            })
        })

        it('logout 시에는 verify.failed가 발화되지 않는다', async () => {
            await fix.jwtService.revokeRefreshToken('garbage')
            expect(fix.events.find((e) => e.type === 'verify.failed')).toBeUndefined()
        })

        it('context가 이벤트에 그대로 전파된다', async () => {
            const ctx = { ip: '1.2.3.4', userAgent: 'jest', source: 'login' }
            await fix.jwtService.generateAuthTokens({ sub: 'u1' }, ctx)

            const issued = fix.events.find((e) => e.type === 'token.issued')
            expect(issued?.context).toEqual(ctx)
        })

        it.todo('logger.error가 예외를 던져도 generateAuthTokens는 정상 동작한다')
    })

    describe('사용자 ID 없는 payload', () => {
        // sub가 없을 때 사용자별 인덱스 없이도 모든 흐름이 동작해야 한다.
        // (storeToken의 if(userId) false 분기, revokeFamily의 if(userId) false 분기)
        it('sub가 없어도 발급, 회전, 폐기가 정상 동작한다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ email: 'no-sub@x' })

            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)
            expect(rotated.refreshToken).not.toEqual(tokens.refreshToken)

            await fix.jwtService.revokeRefreshToken(rotated.refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('sub가 문자열이 아니면 userId로 간주하지 않는다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 12345 })

            await fix.jwtService.revokeAllForUser('12345')

            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)
            expect(rotated.refreshToken).toEqual(expect.any(String))
        })

        it('sub가 없는 토큰도 재사용 감지 시 family가 폐기된다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ email: 'no-sub@x' })
            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(tokens.refreshToken)).rejects.toThrow(
                /reuse detected/i
            )

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })
    })

    describe('알고리즘 고정', () => {
        it.todo('HS256 외의 알고리즘으로 서명된 토큰은 모두 거부한다')

        it('다른 알고리즘으로 서명된 토큰은 거부한다', async () => {
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

    describe('issuer/audience 검증', () => {
        it('issuer가 다른 토큰은 거부한다', async () => {
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

        it('audience가 다른 토큰은 거부한다', async () => {
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
