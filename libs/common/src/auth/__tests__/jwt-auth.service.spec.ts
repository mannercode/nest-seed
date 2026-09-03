import { JwtService } from '@nestjs/jwt'
import {
    type JwtAuthServiceFixture,
    createJwtAuthServiceFixture,
    TEST_AUTH_AUDIENCE,
    TEST_AUTH_ISSUER,
    createJwtAuthServiceFixtureWithShortTtl
} from './jwt-auth.service.fixture.js'

function createExpiredRefreshToken() {
    return new JwtService().signAsync(
        { familyId: 'expired-family', refreshTokenId: 'expired-token', sub: 'u1' },
        {
            algorithm: 'HS256',
            audience: TEST_AUTH_AUDIENCE,
            expiresIn: '-1s',
            issuer: TEST_AUTH_ISSUER,
            secret: 'refreshSecret'
        }
    )
}

async function expireConcurrentRefreshGrace(fix: JwtAuthServiceFixture, refreshToken: string) {
    const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
    const familyId = decoded.familyId as string
    const tokenId = decoded.refreshTokenId as string
    await fix.redis.del(`${fix.jwtService.prefix}:{${familyId}}:consumed:${tokenId}`)
}

function pauseNextRefreshTokenStore(fix: JwtAuthServiceFixture) {
    type JwtAuthInternals = {
        storeToken(
            tokenId: string,
            familyId: string,
            refreshToken: string,
            userId: string | undefined
        ): Promise<void>
    }

    const internals = fix.jwtService as unknown as JwtAuthInternals
    const storeToken = internals.storeToken.bind(internals)
    let announceStoreReached!: () => void
    let releaseStore!: () => void
    const storeReached = new Promise<void>((resolve) => (announceStoreReached = resolve))
    const storeReleased = new Promise<void>((resolve) => (releaseStore = resolve))

    vi.spyOn(internals, 'storeToken').mockImplementationOnce(async (...args) => {
        announceStoreReached()
        await storeReleased
        return storeToken(...args)
    })

    return { releaseStore, storeReached }
}

describe('JwtAuthService', () => {
    let fix: JwtAuthServiceFixture

    beforeEach(async () => {
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

        it('현재 계정 검증을 통과하면 토큰을 발급한다', async () => {
            const validatePayload = vi.fn().mockResolvedValue(true)
            const payload = { email: 'email', sub: 'u1' }

            await expect(
                fix.jwtService.generateAuthTokens(payload, undefined, validatePayload)
            ).resolves.toEqual({
                accessToken: expect.any(String),
                refreshToken: expect.any(String)
            })
            expect(validatePayload).toHaveBeenCalledWith(payload)
        })

        it('발급 중 계정이 철회되면 만든 token family를 폐기하고 401을 반환한다', async () => {
            await expect(
                fix.jwtService.generateAuthTokens(
                    { sub: 'u1' },
                    { source: 'login' },
                    async () => false
                )
            ).rejects.toThrow('The provided refresh token is invalid')

            expect(fix.events).toContainEqual(
                expect.objectContaining({
                    context: { source: 'login' },
                    reason: 'account_revoked',
                    type: 'verify.failed'
                })
            )
            expect(await fix.redis.smembers(`${fix.jwtService.prefix}:user:{u1}:families`)).toEqual(
                []
            )
        })

        it('액세스 토큰에 issuer와 audience가 포함된다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(tokens.accessToken)
            expect(decoded.iss).toBe(TEST_AUTH_ISSUER)
            expect(decoded.aud).toBe(TEST_AUTH_AUDIENCE)
        })

        it('리프레시 토큰에 familyId와 refreshTokenId가 포함된다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)
            expect(decoded.familyId).toEqual(expect.any(String))
            expect(decoded.refreshTokenId).toEqual(expect.any(String))
        })

        // 저장 형식을 직접 단언한다. Redis 키 스키마가 바뀌면 이 테스트도 갱신해야 한다.
        it('토큰·패밀리·사용자 인덱스 키에 리프레시 만료 TTL이 설정된다', async () => {
            const { refreshToken } = await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokenId = decoded.refreshTokenId as string
            const familyId = decoded.familyId as string

            const keys = [
                `${fix.jwtService.prefix}:{${familyId}}:token:${tokenId}`,
                `${fix.jwtService.prefix}:{${familyId}}:family`,
                `${fix.jwtService.prefix}:user:{u1}:families`
            ]
            for (const key of keys) {
                // TTL이 빠지면 PTTL이 -1이라 하한이 회귀를 잡고, 상한 3000은 픽스처 refreshTokenTtlMs와 같아 리프레시 만료에 맞춘 값임을 고정한다.
                const pttl = await fix.redis.pttl(key)
                expect(pttl).toBeGreaterThan(0)
                expect(pttl).toBeLessThanOrEqual(3000)
            }
        })

        it('액세스 토큰 TTL이 1초 미만이면 발급 즉시 만료된다', async () => {
            const fix2 = await createJwtAuthServiceFixtureWithShortTtl()
            try {
                const tokens = await fix2.jwtService.generateAuthTokens({ sub: 'u1' })
                const decoded = new JwtService().decode<Record<string, number>>(tokens.accessToken)

                // ttlMs=500이면 Math.floor(500 / 1000)이 0이라 exp와 iat이 같아져 즉시 만료된다.
                expect(decoded.exp).toBe(decoded.iat)
            } finally {
                await fix2.teardown()
            }
        })

        it('sub가 문자열이 아니면 userId로 간주하지 않는다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 12345 })

            await fix.jwtService.revokeAllForUser('12345')

            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)
            expect(rotated.refreshToken).toEqual(expect.any(String))
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

        it('회전하면 새 인증 토큰을 반환한다', async () => {
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)

            expect(tokens.accessToken).not.toEqual(accessToken)
            expect(tokens.refreshToken).not.toEqual(refreshToken)
        })

        it('현재 계정 검증을 회전 전후 모두 통과하면 새 토큰을 반환한다', async () => {
            const validatePayload = vi.fn().mockResolvedValue(true)

            await expect(
                fix.jwtService.refreshAuthTokens(refreshToken, undefined, validatePayload)
            ).resolves.toEqual({
                accessToken: expect.any(String),
                refreshToken: expect.any(String)
            })
            expect(validatePayload).toHaveBeenCalledTimes(2)
        })

        it('회전 전에 계정이 철회됐으면 token family를 폐기하고 401을 반환한다', async () => {
            const validatePayload = vi.fn().mockResolvedValue(false)

            await expect(
                fix.jwtService.refreshAuthTokens(refreshToken, undefined, validatePayload)
            ).rejects.toThrow('The provided refresh token is invalid')
            expect(validatePayload).toHaveBeenCalledTimes(1)
            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('토큰 소비와 재발급 사이 계정이 철회되면 새 token family를 폐기한다', async () => {
            const validatePayload = vi
                .fn<() => Promise<boolean>>()
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)

            await expect(
                fix.jwtService.refreshAuthTokens(refreshToken, undefined, validatePayload)
            ).rejects.toThrow('The provided refresh token is invalid')
            expect(validatePayload).toHaveBeenCalledTimes(2)
            expect(await fix.redis.smembers(`${fix.jwtService.prefix}:user:{u1}:families`)).toEqual(
                []
            )
        })

        it('토큰 소비 후 저장 전에 단일 로그아웃되면 늦은 저장으로 family가 부활하지 않는다', async () => {
            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const familyId = decoded.familyId as string
            const { releaseStore, storeReached } = pauseNextRefreshTokenStore(fix)

            const rotating = fix.jwtService.refreshAuthTokens(refreshToken)
            const rejectedRotation = expect(rotating).rejects.toThrow(
                'The provided refresh token is invalid'
            )
            await storeReached

            await fix.jwtService.revokeRefreshToken(refreshToken)
            releaseStore()

            await rejectedRotation
            expect(await fix.redis.keys(`${fix.jwtService.prefix}:{${familyId}}:token:*`)).toEqual(
                []
            )
            expect(
                await fix.redis.smembers(`${fix.jwtService.prefix}:user:{u1}:families`)
            ).not.toContain(familyId)
        })

        it('토큰 소비 후 저장 전에 재사용으로 폐기되면 늦은 저장으로 family가 부활하지 않는다', async () => {
            const noUserTokens = await fix.jwtService.generateAuthTokens({
                email: 'no-sub@example.com'
            })
            const noUserRefreshToken = noUserTokens.refreshToken
            const decoded = new JwtService().decode<Record<string, unknown>>(noUserRefreshToken)
            const familyId = decoded.familyId as string
            const siblingTokenId = 'sibling-token'
            const familyKey = `${fix.jwtService.prefix}:{${familyId}}:family`
            const siblingTokenKey = `${fix.jwtService.prefix}:{${familyId}}:token:${siblingTokenId}`
            await fix.redis
                .multi()
                .set(
                    siblingTokenKey,
                    JSON.stringify({ familyId, hash: 'unused-sibling-hash' }),
                    'PX',
                    3000
                )
                .sadd(familyKey, siblingTokenId)
                .pexpire(familyKey, 3000)
                .exec()

            const { releaseStore, storeReached } = pauseNextRefreshTokenStore(fix)
            const rotating = fix.jwtService.refreshAuthTokens(noUserRefreshToken)
            const rejectedRotation = expect(rotating).rejects.toThrow(
                'The provided refresh token is invalid'
            )
            await storeReached
            await expireConcurrentRefreshGrace(fix, noUserRefreshToken)

            await expect(fix.jwtService.refreshAuthTokens(noUserRefreshToken)).rejects.toThrow(
                /reuse detected/i
            )
            releaseStore()

            await rejectedRotation
            expect(await fix.redis.keys(`${fix.jwtService.prefix}:{${familyId}}:token:*`)).toEqual(
                []
            )
        })

        it('회전 후에도 familyId가 유지된다', async () => {
            const before = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)
            const after = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)

            expect(after.familyId).toBe(before.familyId)
        })

        it('형식이 깨진 토큰은 401(잘못된 리프레시 토큰)로 거부한다', async () => {
            const promise = fix.jwtService.refreshAuthTokens('invalid-token')
            await expect(promise).rejects.toThrow('The provided refresh token is invalid')
        })

        it('만료된 토큰은 401(token expired)로 거부한다', async () => {
            const expiredRefreshToken = await createExpiredRefreshToken()
            const promise = fix.jwtService.refreshAuthTokens(expiredRefreshToken)
            await expect(promise).rejects.toThrow('token expired')
        })

        it('동시 중복 유예가 지난 토큰을 다시 쓰면 재사용으로 보고 family를 폐기한다', async () => {
            const rotated = await fix.jwtService.refreshAuthTokens(refreshToken)
            await expireConcurrentRefreshGrace(fix, refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                /reuse detected/i
            )

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('회전 직후 같은 토큰이 다시 오면 전용 409만 반환하고 새 family는 유지한다', async () => {
            const rotated = await fix.jwtService.refreshAuthTokens(refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toMatchObject({
                response: { code: 'ERR_JWT_AUTH_REFRESH_TOKEN_CONCURRENT' },
                status: 409
            })
            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).resolves.toEqual({
                accessToken: expect.any(String),
                refreshToken: expect.any(String)
            })
        })

        it('refreshTokenId나 familyId가 없는 토큰은 거부한다', async () => {
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

        // 동시 회전: 원자적 소비로 하나만 새 토큰을 받고, 나머지는 짧은 tombstone을 보고 전용 409로 끝난다.
        it('동시 회전 시 하나만 성공하고 나머지는 동시 중복 오류로 실패한다', async () => {
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
                expect(l.err).toMatchObject({
                    response: { code: 'ERR_JWT_AUTH_REFRESH_TOKEN_CONCURRENT' },
                    status: 409
                })
            })
        })

        it('즉시 겹친 중복 refresh는 winner의 새 세션을 철회하지 않는다', async () => {
            type StoredToken = { familyId: string; hash: string } | null
            type IssuedTokens = {
                refreshTokenId: string
                tokens: { accessToken: string; refreshToken: string }
            }
            type Internals = {
                getStoredToken(tokenId: string, familyId: string): Promise<StoredToken>
                issueTokensInFamily(
                    payload: object,
                    familyId: string,
                    userId: string | undefined
                ): Promise<IssuedTokens>
                revokeFamily(familyId: string, userId: string | undefined): Promise<void>
            }

            const internals = fix.jwtService as unknown as Internals
            const getStoredToken = internals.getStoredToken.bind(internals)
            let reads = 0
            let releaseReads!: () => void
            const bothRead = new Promise<void>((resolve) => (releaseReads = resolve))
            const synchronizedRead = async (tokenId: string, familyId: string) => {
                const stored = await getStoredToken(tokenId, familyId)
                reads += 1
                if (reads === 2) releaseReads()
                await bothRead
                return stored
            }
            vi.spyOn(internals, 'getStoredToken')
                .mockImplementationOnce(synchronizedRead)
                .mockImplementationOnce(synchronizedRead)

            const issueTokens = internals.issueTokensInFamily.bind(internals)
            let announceIssued!: () => void
            const issued = new Promise<void>((resolve) => (announceIssued = resolve))
            vi.spyOn(internals, 'issueTokensInFamily').mockImplementationOnce(async (...args) => {
                const result = await issueTokens(...args)
                announceIssued()
                return result
            })

            const revokeFamily = internals.revokeFamily.bind(internals)
            vi.spyOn(internals, 'revokeFamily').mockImplementationOnce(async (...args) => {
                await issued
                return revokeFamily(...args)
            })

            const outcomes = await Promise.allSettled([
                fix.jwtService.refreshAuthTokens(refreshToken),
                fix.jwtService.refreshAuthTokens(refreshToken)
            ])
            const winner = outcomes.find(
                (outcome): outcome is PromiseFulfilledResult<IssuedTokens['tokens']> =>
                    outcome.status === 'fulfilled'
            )
            const loser = outcomes.find(
                (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
            )

            expect(winner).toBeDefined()
            expect(loser?.reason).toMatchObject({
                response: { code: 'ERR_JWT_AUTH_REFRESH_TOKEN_CONCURRENT' },
                status: 409
            })
            await expect(
                fix.jwtService.refreshAuthTokens(winner?.value.refreshToken ?? '')
            ).resolves.toEqual({
                accessToken: expect.any(String),
                refreshToken: expect.any(String)
            })
        })

        // 저장 형식을 직접 단언한다. Redis 키 스키마가 바뀌면 이 테스트도 갱신해야 한다.
        it('리프레시 토큰은 SHA-256 해시로 저장하고 평문은 저장하지 않는다', async () => {
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

        it('Redis 값이 손상된 JSON이면 파싱 예외를 그대로 던진다', async () => {
            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const tokenId = decoded.refreshTokenId as string
            const familyId = decoded.familyId as string

            await fix.redis.set(
                `${fix.jwtService.prefix}:{${familyId}}:token:${tokenId}`,
                'not-json{{{'
            )

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                SyntaxError
            )
        })

        it('토큰 키와 family 키가 같은 해시 태그를 쓴다', async () => {
            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const familyId = decoded.familyId as string

            // 두 키 모두 {familyId}를 해시 태그로 사용하므로 Cluster의 같은 슬롯에 배치된다.
            const keys = await fix.redis.keys(`${fix.jwtService.prefix}:{${familyId}}:*`)
            expect(keys.length).toBeGreaterThanOrEqual(2)
        })

        it('회전된 새 토큰에는 이전 토큰의 표준 JWT 클레임이 복사되지 않는다', async () => {
            const before = new JwtService().decode<Record<string, unknown>>(refreshToken)

            const tokens = await fix.jwtService.refreshAuthTokens(refreshToken)
            const after = new JwtService().decode<Record<string, unknown>>(tokens.refreshToken)

            // jti는 재생성되어 달라진다. iat/exp는 같은 초에 재발급되면 이전 값과 같을 수 있어 존재만 확인한다.
            expect(after.jti).not.toBe(before.jti)
            expect(after.iat).not.toBe(undefined)
            expect(after.exp).not.toBe(undefined)
        })

        describe('Redis 원자 소비 결과가 손상될 때', () => {
            beforeEach(() => {
                vi.spyOn(fix.redis, 'eval').mockResolvedValueOnce(null)
            })

            it('토큰 묶음은 폐기하지 않고 예외를 그대로 던진다', async () => {
                await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                    /redis eval returned a non-number/
                )

                const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
                const familyId = decoded.familyId as string
                const stillAlive = await fix.redis.exists(
                    `${fix.jwtService.prefix}:{${familyId}}:family`
                )
                expect(stillAlive).toBe(1)
            })

            it('새 토큰을 발급하지 않는다', async () => {
                await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow()

                // eval mock은 한 번만 적용되므로 리프레시를 다시 호출해 보는 검증은 정상 성공해 버려 쓸 수 없다.
                // 대신 저장 상태로 확인한다.
                // 원본 토큰이 소비되지 않고 남아 있으면 새 토큰 발급 단계까지 가지 않은 것이다.
                const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
                const tokenId = decoded.refreshTokenId as string
                const familyId = decoded.familyId as string
                const stored = await fix.redis.get(
                    `${fix.jwtService.prefix}:{${familyId}}:token:${tokenId}`
                )
                expect(stored).not.toBeNull()
            })
        })
    })

    describe('revokeRefreshToken', () => {
        it('폐기된 토큰으로는 더 이상 회전할 수 없다', async () => {
            const { refreshToken } = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.revokeRefreshToken(refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('폐기 fence를 refresh 토큰 수명 동안 유지한다', async () => {
            const { refreshToken } = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const decoded = new JwtService().decode<Record<string, unknown>>(refreshToken)
            const familyId = decoded.familyId as string

            await fix.jwtService.revokeRefreshToken(refreshToken)

            const pttl = await fix.redis.pttl(`${fix.jwtService.prefix}:{${familyId}}:revoked`)
            expect(pttl).toBeGreaterThan(0)
            expect(pttl).toBeLessThanOrEqual(3000)
        })

        it('형식이 깨진 토큰을 폐기하면 401(잘못된 리프레시 토큰)을 전파한다', async () => {
            await expect(fix.jwtService.revokeRefreshToken('garbage')).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('만료된 토큰을 폐기하면 401(token expired)을 전파한다', async () => {
            const expiredRefreshToken = await createExpiredRefreshToken()
            await expect(fix.jwtService.revokeRefreshToken(expiredRefreshToken)).rejects.toThrow(
                'token expired'
            )
            expect(fix.events.find((e) => e.type === 'verify.failed')).toBeUndefined()
        })

        it('familyId가 없는 토큰을 폐기해도 아무 일도 일어나지 않는다', async () => {
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
        it('한 사용자의 모든 토큰 묶음을 폐기하고 다른 사용자는 영향받지 않는다', async () => {
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

        it('회전 후에도 같은 토큰 묶음이 사용자 인덱스에 유지되어 전체 로그아웃이 동작한다', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const rotated = await fix.jwtService.refreshAuthTokens(initial.refreshToken)

            await fix.jwtService.revokeAllForUser('u1')

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })
    })

    describe('보안 이벤트 훅', () => {
        it('토큰 발급 시 token.issued 이벤트를 남긴다', async () => {
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })

            const issued = fix.events.find((e) => e.type === 'token.issued')
            expect(issued).toMatchObject({
                type: 'token.issued',
                userId: 'u1',
                familyId: expect.any(String),
                tokenId: expect.any(String)
            })
        })

        it('토큰 회전 시 token.refreshed 이벤트를 남긴다', async () => {
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

        it('재사용을 감지하면 token.reuse_detected와 reason=reuse 이벤트를 남긴다', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.refreshAuthTokens(initial.refreshToken)
            await expireConcurrentRefreshGrace(fix, initial.refreshToken)
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

        it('logout 시 reason=logout 이벤트를 남긴다', async () => {
            const initial = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            fix.events.length = 0
            await fix.jwtService.revokeRefreshToken(initial.refreshToken)

            expect(fix.events.find((e) => e.type === 'family.revoked')).toMatchObject({
                reason: 'logout',
                userId: 'u1'
            })
        })

        it('전체 로그아웃 시 토큰 묶음마다 reason=logout_all 이벤트를 남긴다', async () => {
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            fix.events.length = 0

            await fix.jwtService.revokeAllForUser('u1')

            const revokes = fix.events.filter(
                (e) => e.type === 'family.revoked' && e.reason === 'logout_all'
            )
            expect(revokes.length).toBe(2)
        })

        it('검증 실패 시 verify.failed 이벤트를 남긴다', async () => {
            await expect(fix.jwtService.refreshAuthTokens('garbage')).rejects.toThrow()
            expect(fix.events.find((e) => e.type === 'verify.failed')).toMatchObject({
                type: 'verify.failed',
                reason: expect.any(String)
            })
        })

        it('logout 시 잘못된 토큰이면 throw하고 verify.failed 이벤트를 남기지 않는다', async () => {
            // emitOnFailure=false 경로라 verify.failed 이벤트는 발생하지 않는다.
            await expect(fix.jwtService.revokeRefreshToken('garbage')).rejects.toThrow()
            expect(fix.events.find((e) => e.type === 'verify.failed')).toBeUndefined()
        })

        it('context가 이벤트에 그대로 전달된다', async () => {
            const ctx = { ip: '1.2.3.4', userAgent: 'vi', source: 'login' }
            await fix.jwtService.generateAuthTokens({ sub: 'u1' }, ctx)

            const issued = fix.events.find((e) => e.type === 'token.issued')
            expect(issued?.context).toEqual(ctx)
        })

        it('이벤트 훅이 예외를 던지면 generateAuthTokens도 실패한다', async () => {
            vi.spyOn(fix.events, 'push').mockImplementationOnce(() => {
                throw new Error('hook failure')
            })

            await expect(fix.jwtService.generateAuthTokens({ sub: 'u1' })).rejects.toThrow(
                'hook failure'
            )
        })
    })

    describe('페이로드에 사용자 ID가 없을 때', () => {
        let tokens: { accessToken: string; refreshToken: string }

        beforeEach(async () => {
            tokens = await fix.jwtService.generateAuthTokens({ email: 'no-sub@x' })
        })

        it('토큰 발급, 회전, 폐기가 동작한다', async () => {
            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)
            expect(rotated.refreshToken).not.toEqual(tokens.refreshToken)

            await fix.jwtService.revokeRefreshToken(rotated.refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })

        it('재사용을 감지하면 family를 폐기한다', async () => {
            const rotated = await fix.jwtService.refreshAuthTokens(tokens.refreshToken)
            await expireConcurrentRefreshGrace(fix, tokens.refreshToken)

            await expect(fix.jwtService.refreshAuthTokens(tokens.refreshToken)).rejects.toThrow(
                /reuse detected/i
            )

            await expect(fix.jwtService.refreshAuthTokens(rotated.refreshToken)).rejects.toThrow(
                'The provided refresh token is invalid'
            )
        })
    })

    describe('알고리즘 고정', () => {
        const signWithAlgorithm = async (algorithm: string) => {
            return new JwtService().signAsync(
                { familyId: 'x', refreshTokenId: 'y', sub: 'u1' },
                {
                    algorithm: algorithm as any,
                    audience: TEST_AUTH_AUDIENCE,
                    issuer: TEST_AUTH_ISSUER,
                    secret: 'refreshSecret'
                }
            )
        }

        it('알고리즘이 none이면 거부한다', async () => {
            const token = await signWithAlgorithm('none')
            await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toThrow()
        })

        it('알고리즘이 HS384이면 거부한다', async () => {
            const token = await signWithAlgorithm('HS384')
            await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toThrow()
        })

        it('알고리즘이 HS512이면 거부한다', async () => {
            const token = await signWithAlgorithm('HS512')
            await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toThrow()
        })
    })

    describe('issuer와 audience 검증', () => {
        it('issuer가 다른 토큰은 거부한다', async () => {
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
