import { JwtService } from '@nestjs/jwt'
import { JwtAuthErrors, type JwtAuthTokens } from '../index.js'
import {
    type JwtAuthServiceFixture,
    createJwtAuthServiceFixture,
    TEST_AUTH_AUDIENCE,
    TEST_AUTH_ISSUER,
    createJwtAuthServiceFixtureWithShortTtl
} from './jwt-auth.service.fixture.js'

const decode = (token: string) => new JwtService().decode<Record<string, any>>(token)
const sessionKey = (fix: JwtAuthServiceFixture, token: string) => {
    const { sub, sessionId } = decode(token)
    return `${fix.jwtService.prefix}:{${sub}}:session:${sessionId}`
}

function pauseNextTokenIssue(fix: JwtAuthServiceFixture) {
    const internals = fix.jwtService as unknown as {
        createTokens(payload: object, sessionId: string): Promise<JwtAuthTokens>
    }
    const original = internals.createTokens.bind(internals)
    let release!: () => void
    let announce!: () => void
    const reached = new Promise<void>((resolve) => {
        announce = resolve
    })
    const held = new Promise<void>((resolve) => {
        release = resolve
    })
    vi.spyOn(internals, 'createTokens').mockImplementationOnce(async (...args) => {
        announce()
        await held
        return original(...args)
    })
    return { reached, release }
}

async function signedRefresh(payload: object, options: object = {}) {
    return new JwtService().signAsync(payload, {
        algorithm: 'HS256',
        audience: TEST_AUTH_AUDIENCE,
        issuer: TEST_AUTH_ISSUER,
        secret: 'refreshSecret',
        ...options
    })
}

describe('JwtAuthService', () => {
    let fix: JwtAuthServiceFixture
    beforeEach(async () => {
        fix = await createJwtAuthServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('generateAuthTokens', () => {
        it('역할 클레임과 issuer·audience를 가진 토큰을 발급한다', async () => {
            const tokens = await fix.jwtService.generateAuthTokens({ sub: 'u1', email: 'email' })
            expect(decode(tokens.accessToken)).toMatchObject({
                sub: 'u1',
                email: 'email',
                iss: TEST_AUTH_ISSUER,
                aud: TEST_AUTH_AUDIENCE
            })
            expect(decode(tokens.accessToken).sessionId).toBeUndefined()
            expect(decode(tokens.refreshToken)).toMatchObject({
                sub: 'u1',
                sessionId: expect.any(String)
            })
        })

        it('세션 해시와 사용자 인덱스를 같은 슬롯에 만료와 함께 저장한다', async () => {
            const { refreshToken } = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const key = sessionKey(fix, refreshToken)
            const index = `${fix.jwtService.prefix}:{u1}:sessions`
            expect(await fix.redis.get(key)).toMatch(/^[0-9a-f]{64}$/)
            expect(await fix.redis.get(key)).not.toContain(refreshToken)
            expect(await fix.redis.smembers(index)).toEqual([decode(refreshToken).sessionId])
            for (const name of [key, index]) {
                expect(await fix.redis.pttl(name)).toBeGreaterThan(0)
                expect(await fix.redis.pttl(name)).toBeLessThanOrEqual(3000)
            }
        })

        it('Redis 명령 일부가 실패하면 토큰을 반환하지 않고 500을 던진다', async () => {
            await fix.redis.set(`${fix.jwtService.prefix}:{u1}:sessions`, 'wrong-type')

            await expect(fix.jwtService.generateAuthTokens({ sub: 'u1' })).rejects.toMatchObject({
                status: 500,
                cause: expect.stringContaining('WRONGTYPE')
            })
        })

        it('Redis transaction이 중단되면 토큰을 반환하지 않고 500을 던진다', async () => {
            const index = `${fix.jwtService.prefix}:{u1}:sessions`
            await fix.redis.watch(index)
            await fix.redis.sadd(index, 'changed-session')

            await expect(fix.jwtService.generateAuthTokens({ sub: 'u1' })).rejects.toMatchObject({
                status: 500,
                cause: 'Redis transaction was aborted'
            })
        })

        it('액세스 토큰 TTL이 1초 미만이면 발급 즉시 만료된다', async () => {
            const short = await createJwtAuthServiceFixtureWithShortTtl()
            try {
                const { accessToken } = await short.jwtService.generateAuthTokens({ sub: 'u1' })
                expect(decode(accessToken).exp).toBe(decode(accessToken).iat)
            } finally {
                await short.teardown()
            }
        })

        it.each([{}, { sub: 12345 }, { sub: '' }])(
            '사용자를 식별할 수 없는 %j로 세션을 만들지 않는다',
            async (payload) => {
                await expect(fix.jwtService.generateAuthTokens(payload)).rejects.toMatchObject({
                    status: 401
                })
                expect(await fix.redis.keys(`${fix.jwtService.prefix}:*`)).toEqual([])
            }
        )
    })

    describe('refreshAuthTokens', () => {
        let original: JwtAuthTokens
        beforeEach(async () => {
            original = await fix.jwtService.generateAuthTokens({ sub: 'u1', email: 'email' })
        })

        it('같은 세션의 토큰을 교체하고 업무 클레임을 유지한다', async () => {
            const rotated = await fix.jwtService.refreshAuthTokens(original.refreshToken)
            expect(rotated.accessToken).not.toBe(original.accessToken)
            expect(rotated.refreshToken).not.toBe(original.refreshToken)
            expect(decode(rotated.refreshToken)).toMatchObject({
                sub: 'u1',
                email: 'email',
                sessionId: decode(original.refreshToken).sessionId
            })
            expect(decode(rotated.refreshToken).jti).not.toBe(decode(original.refreshToken).jti)
        })

        it('이미 교체된 토큰을 반복 제출해도 현재 세션은 폐기하지 않는다', async () => {
            const first = await fix.jwtService.refreshAuthTokens(original.refreshToken)
            const second = await fix.jwtService.refreshAuthTokens(first.refreshToken)
            for (const old of [original.refreshToken, first.refreshToken, original.refreshToken]) {
                await expect(fix.jwtService.refreshAuthTokens(old)).rejects.toMatchObject({
                    status: 409,
                    response: JwtAuthErrors.RefreshTokenReplaced()
                })
            }
            await expect(
                fix.jwtService.refreshAuthTokens(second.refreshToken)
            ).resolves.toMatchObject({ refreshToken: expect.any(String) })
        })

        it('동시 갱신은 하나만 성공하고 승자의 새 토큰을 유지한다', async () => {
            const results = await Promise.allSettled(
                Array.from({ length: 8 }, () =>
                    fix.jwtService.refreshAuthTokens(original.refreshToken)
                )
            )
            const successes = results.filter((result) => result.status === 'fulfilled')
            expect(successes).toHaveLength(1)
            for (const result of results.filter((result) => result.status === 'rejected')) {
                expect(result.reason).toMatchObject({
                    status: 409,
                    response: JwtAuthErrors.RefreshTokenReplaced()
                })
            }
            await expect(
                fix.jwtService.refreshAuthTokens(successes[0]!.value.refreshToken)
            ).resolves.toMatchObject({ accessToken: expect.any(String) })
        })

        it.each(['logout', 'logout-all'] as const)(
            '새 토큰 준비 중 %s하면 늦은 갱신이 세션을 되살리지 않는다',
            async (operation) => {
                const pause = pauseNextTokenIssue(fix)
                const rotating = fix.jwtService.refreshAuthTokens(original.refreshToken)
                const rejected = expect(rotating).rejects.toMatchObject({ status: 401 })
                await pause.reached
                if (operation === 'logout')
                    await fix.jwtService.revokeRefreshToken(original.refreshToken)
                else await fix.jwtService.revokeAllForUser('u1')
                pause.release()
                await rejected
                expect(await fix.redis.get(sessionKey(fix, original.refreshToken))).toBeNull()
                expect(await fix.redis.smembers(`${fix.jwtService.prefix}:{u1}:sessions`)).toEqual(
                    []
                )
            }
        )

        it('서명 실패로 새 토큰을 준비하지 못하면 이전 토큰은 유지한다', async () => {
            const internal = fix.jwtService as unknown as { createTokens(): Promise<JwtAuthTokens> }
            vi.spyOn(internal, 'createTokens').mockRejectedValueOnce(new Error('signing failed'))
            await expect(fix.jwtService.refreshAuthTokens(original.refreshToken)).rejects.toThrow(
                'signing failed'
            )
            await expect(
                fix.jwtService.refreshAuthTokens(original.refreshToken)
            ).resolves.toMatchObject({ refreshToken: expect.any(String) })
        })

        it('Redis 원자 교체 결과가 손상되면 실패를 알리고 기존 세션을 유지한다', async () => {
            vi.spyOn(fix.redis, 'eval').mockResolvedValueOnce(null)
            await expect(fix.jwtService.refreshAuthTokens(original.refreshToken)).rejects.toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Refresh token rotation returned an invalid result'
                })
            )
            await expect(
                fix.jwtService.refreshAuthTokens(original.refreshToken)
            ).resolves.toMatchObject({ refreshToken: expect.any(String) })
        })

        it.each([undefined, '', 1])('sessionId가 %s인 토큰은 거부한다', async (sessionId) => {
            const token = await signedRefresh({ sub: 'u1', sessionId })
            await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toMatchObject({
                status: 401
            })
        })

        it('사용자 식별자가 없는 서명된 토큰도 거부한다', async () => {
            await expect(
                fix.jwtService.refreshAuthTokens(await signedRefresh({ sessionId: 's1' }))
            ).rejects.toMatchObject({ status: 401 })
        })
    })

    describe('로그아웃', () => {
        it('세션 삭제 뒤 인덱스 정리가 실패하면 500을 던진다', async () => {
            const { refreshToken } = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.redis.set(`${fix.jwtService.prefix}:{u1}:sessions`, 'wrong-type')

            await expect(fix.jwtService.revokeRefreshToken(refreshToken)).rejects.toMatchObject({
                status: 500,
                cause: expect.stringContaining('WRONGTYPE')
            })
        })

        it('전체 로그아웃의 Redis 명령 일부가 실패하면 500을 던진다', async () => {
            await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const read = fix.redis.smembers.bind(fix.redis)
            vi.spyOn(fix.redis, 'smembers').mockImplementationOnce(async (key) => {
                const ids = await read(key)
                await fix.redis.set(key, 'wrong-type')
                return ids
            })

            await expect(fix.jwtService.revokeAllForUser('u1')).rejects.toMatchObject({
                status: 500,
                cause: expect.stringContaining('WRONGTYPE')
            })
        })

        it('한 세션만 폐기하고 같은 사용자의 다른 로그인은 유지한다', async () => {
            const first = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const second = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            await fix.jwtService.revokeRefreshToken(first.refreshToken)
            await expect(
                fix.jwtService.refreshAuthTokens(first.refreshToken)
            ).rejects.toMatchObject({ status: 401 })
            await expect(
                fix.jwtService.refreshAuthTokens(second.refreshToken)
            ).resolves.toMatchObject({ refreshToken: expect.any(String) })
        })

        it('전체 로그아웃은 회전한 세션까지 폐기하고 다른 사용자는 유지한다', async () => {
            const first = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const rotated = await fix.jwtService.refreshAuthTokens(first.refreshToken)
            const second = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const other = await fix.jwtService.generateAuthTokens({ sub: 'u2' })
            await fix.jwtService.revokeAllForUser('u1')
            for (const token of [rotated.refreshToken, second.refreshToken]) {
                await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toMatchObject({
                    status: 401
                })
            }
            await expect(
                fix.jwtService.refreshAuthTokens(other.refreshToken)
            ).resolves.toMatchObject({ refreshToken: expect.any(String) })
        })

        it('대상 세션을 조회한 뒤 새로 로그인한 세션의 인덱스는 지우지 않는다', async () => {
            const old = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            const read = fix.redis.smembers.bind(fix.redis)
            let added!: JwtAuthTokens
            vi.spyOn(fix.redis, 'smembers').mockImplementationOnce(async (key) => {
                const ids = await read(key)
                added = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
                return ids
            })
            await fix.jwtService.revokeAllForUser('u1')
            await expect(fix.jwtService.refreshAuthTokens(old.refreshToken)).rejects.toMatchObject({
                status: 401
            })
            const rotated = await fix.jwtService.refreshAuthTokens(added.refreshToken)
            await fix.jwtService.revokeAllForUser('u1')
            await expect(
                fix.jwtService.refreshAuthTokens(rotated.refreshToken)
            ).rejects.toMatchObject({ status: 401 })
        })

        it('활성 세션이 없는 사용자의 전체 로그아웃은 멱등이다', async () => {
            await expect(fix.jwtService.revokeAllForUser('missing')).resolves.toBeUndefined()
        })
    })

    describe('서명과 클레임 검증', () => {
        it.each(['refreshAuthTokens', 'revokeRefreshToken'] as const)(
            '%s는 깨진 토큰을 거부한다',
            async (operation) => {
                await expect(fix.jwtService[operation]('garbage')).rejects.toMatchObject({
                    status: 401
                })
            }
        )

        it.each(['refreshAuthTokens', 'revokeRefreshToken'] as const)(
            '%s는 만료된 토큰을 거부한다',
            async (operation) => {
                const token = await signedRefresh(
                    { sub: 'u1', sessionId: 's1' },
                    { expiresIn: '-1s' }
                )
                await expect(fix.jwtService[operation](token)).rejects.toMatchObject({
                    status: 401,
                    response: JwtAuthErrors.RefreshTokenInvalid()
                })
            }
        )

        it.each(['none', 'HS384', 'HS512'])('%s 알고리즘을 거부한다', async (algorithm) => {
            await expect(
                fix.jwtService.refreshAuthTokens(
                    await signedRefresh({ sub: 'u1', sessionId: 's1' }, { algorithm })
                )
            ).rejects.toMatchObject({ status: 401 })
        })

        it.each([{ issuer: 'other' }, { audience: 'other' }, { secret: 'wrong' }])(
            '기대와 다른 검증 조건 %j를 거부한다',
            async (options) => {
                await expect(
                    fix.jwtService.refreshAuthTokens(
                        await signedRefresh({ sub: 'u1', sessionId: 's1' }, options)
                    )
                ).rejects.toMatchObject({ status: 401 })
            }
        )
    })
})
