import { oid } from '@mannercode/testing'
import { HttpStatus, type INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from '#config'
import {
    type UserDto,
    type PurchaseRecordDto,
    UsersService,
    UserSchema,
    PurchaseRecordSchema
} from '#core'
import {
    createPurchaseRecord,
    createUser,
    Errors,
    loginUser,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { LoginRateLimiterService } from '#gateway'
import { ensure, JwtAuthService, TimeUtil } from '@mannercode/common'

const IP_FAILURE_LIMIT = 50
const LOGIN_RATE_LIMITED_ERROR = {
    code: 'ERR_AUTH_LOGIN_RATE_LIMITED',
    message: 'Too many login attempts'
}

function trustPrivateProxy(app: INestApplication) {
    app.getHttpAdapter().getInstance().set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
}

type JwtAuthInternals = {
    createTokens(
        payload: object,
        sessionId: string
    ): Promise<{ accessToken: string; refreshToken: string }>
}

function pauseNextTokenIssue(jwtAuthService: object) {
    const internals = jwtAuthService as JwtAuthInternals
    const createTokens = internals.createTokens.bind(internals)
    let announceStarted!: () => void
    let release!: () => void
    const started = new Promise<void>((resolve) => (announceStarted = resolve))
    const held = new Promise<void>((resolve) => (release = resolve))
    vi.spyOn(internals, 'createTokens').mockImplementationOnce(async (payload, sessionId) => {
        announceStarted()
        await held
        return createTokens(payload, sessionId)
    })
    return { release, started }
}

describe('UserAuthentication', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    const credentials = { email: 'user@mail.com', password: 'password' }

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext({ configureApp: async (app) => trustPrivateProxy(app) })
        teardown = fix.teardown

        await createUser(fix, credentials)
    })
    afterEach(() => teardown?.())

    describe('POST /users/login', () => {
        it('자격 증명이 유효하면 인증 토큰을 반환한다', async () => {
            const { body } = await fix.httpClient
                .post('/users/login')
                .body(credentials)
                .ok({
                    expected: { accessToken: expect.any(String), refreshToken: expect.any(String) }
                })

            const { exp, iat } = new JwtService().decode<{ exp: number; iat: number }>(
                body.accessToken
            )
            const { auth } = fix.module.get(AppConfigService)
            expect(exp - iat).toBe(TimeUtil.toMs(auth.accessTokenExpiration) / 1000)
        })

        it('비밀번호가 틀리면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/login')
                .body({ ...credentials, password: 'wrong password' })
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        it('등록되지 않은 이메일이면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/login')
                .body({ ...credentials, email: 'unknown@mail.com' })
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        describe('여러 IP에서 같은 계정으로 로그인에 실패한 기록이 있으면', () => {
            beforeEach(async () => {
                for (let index = 0; index < 6; index++) {
                    await fix.httpClient
                        .post('/users/login')
                        .headers({ 'X-Forwarded-For': `198.51.100.${index + 1}` })
                        .body({ ...credentials, password: 'wrong password' })
                        .unauthorized({ expected: Errors.Auth.Unauthorized() })
                }
            })
            it('다른 IP에서 올바른 비밀번호로 로그인할 수 있다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': '198.51.100.7' })
                    .body(credentials)
                    .ok()
            })
        })

        describe('같은 IP에서 49회 로그인 실패 후 한 번 성공했으면', () => {
            let ip: string
            beforeEach(async () => {
                ip = '198.51.100.100'

                for (let index = 0; index < IP_FAILURE_LIMIT - 1; index++) {
                    await fix.httpClient
                        .post('/users/login')
                        .headers({ 'X-Forwarded-For': ip })
                        .body({ email: `unknown-${index}@mail.com`, password: 'wrong password' })
                        .unauthorized({ expected: Errors.Auth.Unauthorized() })
                }

                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body(credentials)
                    .ok()
            })
            it('다음 실패는 401, 그 다음 요청은 429를 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body({ email: 'unknown-50@mail.com', password: 'wrong password' })
                    .unauthorized({ expected: Errors.Auth.Unauthorized() })

                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body({ email: 'unknown-51@mail.com', password: 'wrong password' })
                    .send(HttpStatus.TOO_MANY_REQUESTS, { expected: LOGIN_RATE_LIMITED_ERROR })
            })
        })

        describe('같은 Redis를 쓰는 다른 앱에 IP 실패 한도가 쌓여 있으면', () => {
            let replica: AppTestContext | undefined
            beforeEach(async () => {
                replica = undefined
                replica = await createAppTestContext({
                    configureApp: async (app) => trustPrivateProxy(app)
                })
                const limiter = fix.module.get(LoginRateLimiterService)
                for (let index = 0; index < IP_FAILURE_LIMIT; index++)
                    await limiter.recordFailure('203.0.113.2')
            })
            afterEach(() => replica?.teardown())
            it('이 앱에서도 같은 IP의 로그인 요청에 429를 반환한다', async () => {
                await ensure(replica)
                    .httpClient.post('/users/login')
                    .headers({ 'X-Forwarded-For': '203.0.113.2' })
                    .body(credentials)
                    .send(HttpStatus.TOO_MANY_REQUESTS, { expected: LOGIN_RATE_LIMITED_ERROR })
            })
        })
    })

    describe('GET /users/me', () => {
        describe('사용자로 로그인했으면', () => {
            let authTokens: Awaited<ReturnType<typeof loginUser>>
            beforeEach(async () => {
                authTokens = await loginUser(fix, credentials)
            })
            it('로그인한 사용자 정보를 반환한다', async () => {
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${authTokens.accessToken}` })
                    .ok({
                        schema: UserSchema,
                        expected: expect.objectContaining({
                            id: expect.any(String),
                            email: credentials.email,
                            name: expect.any(String)
                        })
                    })
            })

            it('리프레시 토큰을 액세스 토큰 자리에 쓰면 401을 반환한다', async () => {
                // 두 토큰은 iss/aud가 같아 secret 분리만이 방벽이다 — 이 검증이 무너지면
                // 수명이 긴 리프레시 토큰이 로그아웃으로도 회수되지 않는 액세스 토큰으로 동작한다.
                const { refreshToken } = authTokens

                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${refreshToken}` })
                    .unauthorized({ expected: Errors.Auth.Unauthorized() })
            })
        })

        it('액세스 토큰이 검증되지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        describe.each([
            { condition: '사용자 ID가 빠진 토큰이 있으면', payload: { email: 'user@mail.com' } },
            {
                condition: '이메일 형식이 잘못된 토큰이 있으면',
                payload: { email: 'invalid', sub: 'user-id' }
            }
        ])('올바르게 서명했지만 $condition', ({ payload }) => {
            let token: string

            beforeEach(async () => {
                const { auth } = fix.module.get(AppConfigService)
                token = await new JwtService().signAsync(payload, {
                    audience: auth.audience,
                    issuer: auth.issuer,
                    secret: auth.accessSecret,
                    expiresIn: '5m'
                })
            })

            it('본인 조회 요청에 401을 반환한다', async () => {
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${token}` })
                    .unauthorized({ expected: Errors.Auth.Unauthorized() })
            })
        })
    })

    describe('DELETE /users/me', () => {
        describe('로그인했을 때', () => {
            let accessToken: string

            beforeEach(async () => {
                ;({ accessToken } = await loginUser(fix, credentials))
            })

            it('204를 반환한다', async () => {
                await fix.httpClient
                    .delete('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .noContent()
            })
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.delete('/users/me').unauthorized()
        })
    })

    describe('PATCH /users/me', () => {
        describe('로그인했을 때', () => {
            let accessToken: string
            let user: UserDto
            const updateDto = { name: 'updated-name' }

            beforeEach(async () => {
                ;({ accessToken, user } = await loginUser(fix, credentials))
            })

            it('수정된 DTO를 반환한다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(updateDto)
                    .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
            })

            it('수정 내용이 DB에 저장된다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(updateDto)
                    .ok({ schema: UserSchema })

                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
            })

            it('비밀번호를 변경해도 기존 액세스 토큰으로 본인 정보를 조회할 수 있다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ password: 'newPassword' })
                    .ok({ schema: UserSchema })
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ schema: UserSchema, expected: user })
            })
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.patch('/users/me').body({ name: 'x' }).unauthorized()
        })
    })

    describe('GET /users/me/purchases', () => {
        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.get('/users/me/purchases').unauthorized()
        })

        describe('사용자로 로그인했으면', () => {
            let accessToken: string
            let user: UserDto
            beforeEach(async () => {
                ;({ accessToken, user } = await loginUser(fix, credentials))
            })
            describe('서로 다른 사용자 ID의 구매 기록이 존재하면', () => {
                let mine1: PurchaseRecordDto
                let mine2: PurchaseRecordDto
                beforeEach(async () => {
                    // 본인 기록 둘과 타인 기록 하나를 심어, 토큰 주체의 것만 조회되는지 본다.
                    mine1 = await createPurchaseRecord(fix, { userId: user.id })
                    mine2 = await createPurchaseRecord(fix, { userId: user.id })
                    await createPurchaseRecord(fix, { userId: oid(0xff) })
                })
                it('로그인한 사용자의 구매 기록만 반환한다', async () => {
                    const { body } = await fix.httpClient
                        .get('/users/me/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .ok({ schema: PurchaseRecordSchema.array() })

                    expect(body).toEqual(expect.arrayContaining([mine1, mine2]))
                    expect(body).toHaveLength(2)
                    expect(
                        body.every((record: { userId: string }) => record.userId === user.id)
                    ).toBe(true)
                })
            })
            it('구매 기록이 없으면 빈 배열을 반환한다', async () => {
                await fix.httpClient
                    .get('/users/me/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ schema: PurchaseRecordSchema.array(), expected: [] })
            })
        })
    })

    describe('POST /users/refresh', () => {
        describe('유효한 리프레시 토큰을 가지고 있을 때', () => {
            let tokens: Awaited<ReturnType<typeof loginUser>>

            beforeEach(async () => {
                tokens = await loginUser(fix, credentials)
            })

            it('새 액세스 토큰과 리프레시 토큰을 반환한다', async () => {
                const { body } = await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: tokens.refreshToken })
                    .ok({
                        expected: {
                            accessToken: expect.stringMatching(/\S/),
                            refreshToken: expect.stringMatching(/\S/)
                        }
                    })

                expect(body.accessToken).not.toEqual(tokens.accessToken)
                expect(body.refreshToken).not.toEqual(tokens.refreshToken)
            })
        })

        it('리프레시 토큰이 검증되지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: 'invalid-token' })
                .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
        })
    })

    describe('POST /users/logout', () => {
        let accessToken: string
        let refreshToken: string
        let user: UserDto

        beforeEach(async () => {
            ;({ accessToken, refreshToken, user } = await loginUser(fix, credentials))
        })

        it('로그아웃하면 204를 반환한다', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()
        })

        it('로그아웃하면 리프레시 갱신은 거절하고 기존 액세스 토큰으로 본인 조회는 허용한다', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })

            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok({ schema: UserSchema, expected: user })
        })

        it('잘못된 토큰으로 로그아웃하면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/logout')
                .body({ refreshToken: 'garbage' })
                .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
        })
    })

    describe('POST /users/me/logout-all', () => {
        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.post('/users/me/logout-all').unauthorized()
        })

        describe('두 로그인 세션이 존재하면', () => {
            let sessionA: Awaited<ReturnType<typeof loginUser>>
            let sessionB: Awaited<ReturnType<typeof loginUser>>
            beforeEach(async () => {
                sessionA = await loginUser(fix, credentials)
                sessionB = await loginUser(fix, credentials)
            })
            it('전체 로그아웃하면 두 세션의 리프레시 토큰으로 갱신할 수 없다', async () => {
                await fix.httpClient
                    .post('/users/me/logout-all')
                    .headers({ Authorization: `Bearer ${sessionA.accessToken}` })
                    .noContent()

                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: sessionA.refreshToken })
                    .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })

                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: sessionB.refreshToken })
                    .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
            })
            it('전체 로그아웃해도 기존 액세스 토큰으로 본인 정보를 조회할 수 있다', async () => {
                await fix.httpClient
                    .post('/users/me/logout-all')
                    .headers({ Authorization: `Bearer ${sessionA.accessToken}` })
                    .noContent()
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${sessionA.accessToken}` })
                    .ok({ schema: UserSchema, expected: sessionA.user })
            })
        })
    })

    describe('LoginRateLimiterService.recordFailure', () => {
        it('동시에 51회 실패를 기록하면 한 요청을 429 예외로 거절한다', async () => {
            const rateLimiter = fix.module.get(LoginRateLimiterService)
            const results = await Promise.allSettled(
                Array.from({ length: IP_FAILURE_LIMIT + 1 }, () =>
                    rateLimiter.recordFailure('203.0.113.1')
                )
            )
            const rejected = results.filter((result) => result.status === 'rejected')
            expect(rejected).toHaveLength(1)
            expect(rejected[0]).toMatchObject({
                reason: { response: LOGIN_RATE_LIMITED_ERROR, status: HttpStatus.TOO_MANY_REQUESTS }
            })
        })
    })

    describe('로그인한 사용자가 탈퇴했으면', () => {
        let accessToken: string
        let user: UserDto
        beforeEach(async () => {
            ;({ accessToken, user } = await loginUser(fix, credentials))
            await fix.httpClient
                .delete('/users/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .noContent()
        })
        it('기존 액세스 토큰으로 본인 조회를 요청하면 404를 반환한다', async () => {
            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .notFound({ expected: Errors.Mongo.MultipleDocumentsNotFound([user.id]) })
        })
        it('기존 액세스 토큰으로 본인 수정을 요청하면 404를 반환한다', async () => {
            await fix.httpClient
                .patch('/users/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ name: 'must-not-change' })
                .notFound({ expected: Errors.Mongo.DocumentNotFound(user.id) })
        })
    })

    describe('리프레시 토큰 발급이 진행 중이면', () => {
        let session: Awaited<ReturnType<typeof loginUser>>
        let usersService: UsersService
        let gate: ReturnType<typeof pauseNextTokenIssue> | undefined
        let refreshResult: Promise<PromiseSettledResult<unknown>[]> | undefined
        beforeEach(async () => {
            gate = undefined
            refreshResult = undefined
            session = await loginUser(fix, credentials)
            usersService = fix.module.get(UsersService)
            gate = pauseNextTokenIssue(fix.module.get(JwtAuthService.getName()))
            refreshResult = Promise.allSettled([
                usersService.refreshAuthTokens(session.refreshToken)
            ])
            await gate.started
        })
        afterEach(async () => {
            gate?.release()
            await refreshResult
        })
        it('비밀번호를 변경하면 진행 중인 발급을 401 예외로 거절하고 기존 액세스 토큰은 유지한다', async () => {
            try {
                await usersService.update(session.user.id, { password: 'newPassword' })
            } finally {
                gate?.release()
            }
            expect(await refreshResult).toMatchObject([
                {
                    status: 'rejected',
                    reason: {
                        status: HttpStatus.UNAUTHORIZED,
                        response: Errors.JwtAuth.RefreshTokenInvalid()
                    }
                }
            ])
            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${session.accessToken}` })
                .ok({ schema: UserSchema, expected: session.user })
        })
        it('전체 로그아웃하면 진행 중인 발급을 401 예외로 거절하고 기존 액세스 토큰은 유지한다', async () => {
            try {
                await usersService.revokeAllForUser(session.user.id)
            } finally {
                gate?.release()
            }
            expect(await refreshResult).toMatchObject([
                {
                    status: 'rejected',
                    reason: {
                        status: HttpStatus.UNAUTHORIZED,
                        response: Errors.JwtAuth.RefreshTokenInvalid()
                    }
                }
            ])
            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${session.accessToken}` })
                .ok({ schema: UserSchema, expected: session.user })
        })
    })
})
