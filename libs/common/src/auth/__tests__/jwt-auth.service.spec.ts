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
        it('사용자 클레임과 issuer·audience를 가진 토큰을 발급한다', async () => {
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

        it('토큰 발급 시 세션 해시와 사용자 인덱스를 만료 시간과 함께 저장한다', async () => {
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

        describe('세션 인덱스 키에 집합 대신 문자열이 저장되어 있으면', () => {
            beforeEach(async () => {
                await fix.redis.set(`${fix.jwtService.prefix}:{u1}:sessions`, 'wrong-type')
            })
            it('토큰 발급 시 Redis 자료형 오류를 원인으로 500 예외를 던진다', async () => {
                await expect(
                    fix.jwtService.generateAuthTokens({ sub: 'u1' })
                ).rejects.toMatchObject({
                    status: 500,
                    cause: expect.stringContaining('WRONGTYPE')
                })
            })
        })

        describe('감시 중인 세션 인덱스가 변경되었으면', () => {
            beforeEach(async () => {
                const index = `${fix.jwtService.prefix}:{u1}:sessions`
                await fix.redis.watch(index)
                await fix.redis.sadd(index, 'changed-session')
            })
            it('토큰 발급 시 트랜잭션 중단을 원인으로 500 예외를 던진다', async () => {
                await expect(
                    fix.jwtService.generateAuthTokens({ sub: 'u1' })
                ).rejects.toMatchObject({ status: 500, cause: 'Redis transaction was aborted' })
            })
        })

        describe('액세스 토큰 TTL이 1초 미만이면', () => {
            let short: JwtAuthServiceFixture
            beforeEach(async () => {
                short = await createJwtAuthServiceFixtureWithShortTtl()
            })
            afterEach(() => short.teardown())
            it('토큰 발급 시 만료 시각이 발급 시각과 같다', async () => {
                const { accessToken } = await short.jwtService.generateAuthTokens({ sub: 'u1' })
                expect(decode(accessToken).exp).toBe(decode(accessToken).iat)
            })
        })

        describe.each([
            { label: 'sub가 없는', payload: {} },
            { label: 'sub가 숫자인', payload: { sub: 12345 } },
            { label: 'sub가 빈 문자열인', payload: { sub: '' } }
        ])('$label 인증 정보가 있으면', ({ payload }) => {
            let claims: typeof payload
            beforeEach(() => {
                claims = payload
            })
            it('토큰을 발급하면 401 예외를 던지고 세션을 만들지 않는다', async () => {
                await expect(fix.jwtService.generateAuthTokens(claims)).rejects.toMatchObject({
                    status: 401
                })
                expect(await fix.redis.keys(`${fix.jwtService.prefix}:*`)).toEqual([])
            })
        })
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

        describe('같은 세션의 토큰을 두 번 교체했으면', () => {
            let first: JwtAuthTokens
            let second: JwtAuthTokens
            beforeEach(async () => {
                first = await fix.jwtService.refreshAuthTokens(original.refreshToken)
                second = await fix.jwtService.refreshAuthTokens(first.refreshToken)
            })
            it('이전 토큰으로 갱신하면 409 예외를 던지고 최신 토큰은 계속 갱신할 수 있다', async () => {
                for (const old of [
                    original.refreshToken,
                    first.refreshToken,
                    original.refreshToken
                ]) {
                    await expect(fix.jwtService.refreshAuthTokens(old)).rejects.toMatchObject({
                        status: 409,
                        response: JwtAuthErrors.RefreshTokenReplaced()
                    })
                }
                await expect(
                    fix.jwtService.refreshAuthTokens(second.refreshToken)
                ).resolves.toMatchObject({ refreshToken: expect.any(String) })
            })
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

        describe('새 토큰 발급을 일시 중지하도록 설정하면', () => {
            let pause: ReturnType<typeof pauseNextTokenIssue>
            beforeEach(() => {
                pause = pauseNextTokenIssue(fix)
            })
            afterEach(() => pause.release())
            it.each(['logout', 'logout-all'] as const)(
                '새 토큰 준비 중 %s하면 늦은 갱신이 세션을 되살리지 않는다',
                async (operation) => {
                    const rotating = fix.jwtService.refreshAuthTokens(original.refreshToken)
                    const rejected = expect(rotating).rejects.toMatchObject({ status: 401 })
                    await pause.reached
                    if (operation === 'logout')
                        await fix.jwtService.revokeRefreshToken(original.refreshToken)
                    else await fix.jwtService.revokeAllSessions('u1')
                    pause.release()
                    await rejected
                    expect(await fix.redis.get(sessionKey(fix, original.refreshToken))).toBeNull()
                    expect(
                        await fix.redis.smembers(`${fix.jwtService.prefix}:{u1}:sessions`)
                    ).toEqual([])
                }
            )
        })
        describe('다음 토큰 서명이 실패하도록 설정하면', () => {
            beforeEach(() => {
                const internal = fix.jwtService as unknown as {
                    createTokens(): Promise<JwtAuthTokens>
                }
                vi.spyOn(internal, 'createTokens').mockRejectedValueOnce(
                    new Error('signing failed')
                )
            })
            it('갱신은 오류를 던지고 이전 토큰으로 다시 갱신할 수 있다', async () => {
                await expect(
                    fix.jwtService.refreshAuthTokens(original.refreshToken)
                ).rejects.toThrow('signing failed')
                await expect(
                    fix.jwtService.refreshAuthTokens(original.refreshToken)
                ).resolves.toMatchObject({ refreshToken: expect.any(String) })
            })
        })

        describe('Redis가 토큰 교체 결과로 null을 반환하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.redis, 'eval').mockResolvedValueOnce(null)
            })
            it('갱신은 500 예외를 던지고 기존 토큰으로 다시 갱신할 수 있다', async () => {
                await expect(
                    fix.jwtService.refreshAuthTokens(original.refreshToken)
                ).rejects.toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Refresh token rotation returned an invalid result'
                    })
                )
                await expect(
                    fix.jwtService.refreshAuthTokens(original.refreshToken)
                ).resolves.toMatchObject({ refreshToken: expect.any(String) })
            })
        })

        describe.each([
            { label: 'sessionId가 없는', sessionId: undefined },
            { label: 'sessionId가 빈 문자열인', sessionId: '' },
            { label: 'sessionId가 숫자인', sessionId: 1 }
        ])('$label 리프레시 토큰이 있으면', ({ sessionId }) => {
            let token: string
            beforeEach(async () => {
                token = await signedRefresh({ sub: 'u1', sessionId })
            })
            it('토큰을 갱신하면 401 예외를 던진다', async () => {
                await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toMatchObject({
                    status: 401
                })
            })
        })

        describe('서명된 토큰에 사용자 식별자가 없으면', () => {
            let token: string
            beforeEach(async () => {
                token = await signedRefresh({ sessionId: 's1' })
            })
            it('토큰을 갱신하면 401 예외를 던진다', async () => {
                await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toMatchObject({
                    status: 401
                })
            })
        })
    })

    describe('로그아웃', () => {
        describe('세션은 존재하지만 세션 인덱스가 문자열로 바뀌었으면', () => {
            let tokens: JwtAuthTokens
            beforeEach(async () => {
                tokens = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
                await fix.redis.set(`${fix.jwtService.prefix}:{u1}:sessions`, 'wrong-type')
            })
            it('로그아웃 시 Redis 자료형 오류를 원인으로 500 예외를 던진다', async () => {
                await expect(
                    fix.jwtService.revokeRefreshToken(tokens.refreshToken)
                ).rejects.toMatchObject({
                    status: 500,
                    cause: expect.stringContaining('WRONGTYPE')
                })
            })
        })

        describe('세션 인덱스 조회 직후 인덱스 자료형이 바뀌도록 설정하면', () => {
            beforeEach(async () => {
                await fix.jwtService.generateAuthTokens({ sub: 'u1' })
                const read = fix.redis.smembers.bind(fix.redis)
                vi.spyOn(fix.redis, 'smembers').mockImplementationOnce(async (key) => {
                    const ids = await read(key)
                    await fix.redis.set(key, 'wrong-type')
                    return ids
                })
            })
            it('전체 로그아웃 시 Redis 자료형 오류를 원인으로 500 예외를 던진다', async () => {
                await expect(fix.jwtService.revokeAllSessions('u1')).rejects.toMatchObject({
                    status: 500,
                    cause: expect.stringContaining('WRONGTYPE')
                })
            })
        })

        describe('같은 사용자의 로그인 세션이 두 개 존재하면', () => {
            let first: JwtAuthTokens
            let second: JwtAuthTokens
            beforeEach(async () => {
                first = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
                second = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
            })
            it('한 세션을 로그아웃하면 그 토큰만 갱신을 거부하고 다른 세션은 유지한다', async () => {
                await fix.jwtService.revokeRefreshToken(first.refreshToken)
                await expect(
                    fix.jwtService.refreshAuthTokens(first.refreshToken)
                ).rejects.toMatchObject({ status: 401 })
                await expect(
                    fix.jwtService.refreshAuthTokens(second.refreshToken)
                ).resolves.toMatchObject({ refreshToken: expect.any(String) })
            })
        })

        describe('토큰을 갱신한 세션과 다른 로그인 세션 및 다른 사용자의 세션이 존재하면', () => {
            let rotated: JwtAuthTokens
            let second: JwtAuthTokens
            let other: JwtAuthTokens
            beforeEach(async () => {
                const first = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
                rotated = await fix.jwtService.refreshAuthTokens(first.refreshToken)
                second = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
                other = await fix.jwtService.generateAuthTokens({ sub: 'u2' })
            })
            it('전체 로그아웃하면 대상 사용자의 모든 세션을 폐기하고 다른 사용자는 유지한다', async () => {
                await fix.jwtService.revokeAllSessions('u1')
                for (const token of [rotated.refreshToken, second.refreshToken]) {
                    await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toMatchObject({
                        status: 401
                    })
                }
                await expect(
                    fix.jwtService.refreshAuthTokens(other.refreshToken)
                ).resolves.toMatchObject({ refreshToken: expect.any(String) })
            })
        })

        describe('로그아웃 대상 조회 직후 새 세션이 생성되도록 설정하면', () => {
            let old: JwtAuthTokens
            let added: JwtAuthTokens
            beforeEach(async () => {
                old = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
                const read = fix.redis.smembers.bind(fix.redis)
                vi.spyOn(fix.redis, 'smembers').mockImplementationOnce(async (key) => {
                    const ids = await read(key)
                    added = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
                    return ids
                })
            })
            it('전체 로그아웃은 이전 세션만 폐기하고 새 세션은 다음 로그아웃에서 폐기한다', async () => {
                await fix.jwtService.revokeAllSessions('u1')
                await expect(
                    fix.jwtService.refreshAuthTokens(old.refreshToken)
                ).rejects.toMatchObject({ status: 401 })
                const rotated = await fix.jwtService.refreshAuthTokens(added.refreshToken)
                await fix.jwtService.revokeAllSessions('u1')
                await expect(
                    fix.jwtService.refreshAuthTokens(rotated.refreshToken)
                ).rejects.toMatchObject({ status: 401 })
            })
        })

        describe('사용자의 활성 세션이 없으면', () => {
            let userId: string
            beforeEach(() => {
                userId = 'missing'
            })
            it('전체 로그아웃을 요청하면 오류 없이 완료한다', async () => {
                await expect(fix.jwtService.revokeAllSessions(userId)).resolves.toBeUndefined()
            })
        })
    })

    describe('서명과 클레임 검증', () => {
        describe('토큰 문자열이 깨져 있으면', () => {
            let token: string
            beforeEach(() => {
                token = 'garbage'
            })
            it.each(['refreshAuthTokens', 'revokeRefreshToken'] as const)(
                '%s를 호출하면 401 예외를 던진다',
                async (operation) => {
                    await expect(fix.jwtService[operation](token)).rejects.toMatchObject({
                        status: 401
                    })
                }
            )
        })

        describe('리프레시 토큰이 만료되었으면', () => {
            let token: string
            beforeEach(async () => {
                token = await signedRefresh({ sub: 'u1', sessionId: 's1' }, { expiresIn: '-1s' })
            })
            it.each(['refreshAuthTokens', 'revokeRefreshToken'] as const)(
                '%s를 호출하면 401 예외를 던진다',
                async (operation) => {
                    await expect(fix.jwtService[operation](token)).rejects.toMatchObject({
                        status: 401,
                        response: JwtAuthErrors.RefreshTokenInvalid()
                    })
                }
            )
        })

        describe.each(['none', 'HS384', 'HS512'])('토큰 서명 알고리즘이 %s이면', (algorithm) => {
            let token: string
            beforeEach(async () => {
                token = await signedRefresh({ sub: 'u1', sessionId: 's1' }, { algorithm })
            })
            it('토큰을 갱신하면 401 예외를 던진다', async () => {
                await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toMatchObject({
                    status: 401
                })
            })
        })

        describe.each([
            { label: 'issuer가 다른', options: { issuer: 'other' } },
            { label: 'audience가 다른', options: { audience: 'other' } },
            { label: '서명 키가 다른', options: { secret: 'wrong' } }
        ])('$label 리프레시 토큰이 있으면', ({ options }) => {
            let token: string
            beforeEach(async () => {
                token = await signedRefresh({ sub: 'u1', sessionId: 's1' }, options)
            })
            it('토큰을 갱신하면 401 예외를 던진다', async () => {
                await expect(fix.jwtService.refreshAuthTokens(token)).rejects.toMatchObject({
                    status: 401
                })
            })
        })
    })
})
