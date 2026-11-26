import { HttpStatus } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Collection } from 'mongodb'
import { AppConfigService, REDIS_CONNECTION_NAME } from '#config'
import { type UserDto, UsersService, UserSchema } from '#core'
import {
    buildCreateUserDto,
    createUser,
    expectedErrors,
    loginUser,
    type AppTestContext,
    createAppTestContext
} from '#test-helpers'
import {
    ensure,
    getRedisConnectionToken,
    JwtAuthService,
    type JwtAuthTokens,
    PasswordHasher,
    type RedisConnection,
    TimeUtil
} from '@mannercode/common'

// AppConfigModule을 import할 때 Nest가 환경 변수를 검증해 저장하므로 두 앱의 한도를 먼저 설정한다.
const IP_FAILURE_LIMIT = vi.hoisted(() => {
    const limit = 3
    vi.stubEnv('AUTH_LOGIN_IP_FAILURE_LIMIT', String(limit))
    vi.stubEnv('AUTH_LOGIN_FAILURE_WINDOW', '5m')
    return limit
})
const LOGIN_RATE_LIMITED_ERROR = {
    code: 'ERR_AUTH_LOGIN_RATE_LIMITED',
    message: 'Too many login attempts'
}

type ResumeRequest<T> = () => Promise<T>

async function pauseNextTokenIssue<T>(request: () => Promise<T>): Promise<ResumeRequest<T>> {
    const started = Promise.withResolvers<void>()
    const held = Promise.withResolvers<void>()
    const sign = JwtService.prototype.signAsync
    vi.spyOn(JwtService.prototype, 'signAsync').mockImplementationOnce(async function (
        this: JwtService,
        payload,
        options
    ) {
        started.resolve()
        await held.promise
        return sign.call(this, payload, options)
    })
    try {
        const response = request()
        await Promise.race([
            started.promise,
            response.then(() => {
                throw new Error('HTTP request completed before JWT signing started')
            })
        ])
        return () => {
            held.resolve()
            return response
        }
    } catch (error) {
        held.resolve()
        throw error
    }
}

async function expectCurrentUser(
    fix: AppTestContext,
    session: { accessToken: string; user: UserDto }
) {
    await fix.httpClient
        .get('/users/me')
        .headers({ Authorization: `Bearer ${session.accessToken}` })
        .ok({ schema: UserSchema, expected: session.user })
}

describe('UserAuthentication', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    const credentials = { email: 'user@mail.com', password: 'Example password 1!' }

    beforeEach(async () => {
        teardown = undefined
        fix = await createAppTestContext()
        teardown = fix.teardown

        await createUser(fix, credentials)
    })
    afterEach(() => teardown?.())

    describe.each([
        { condition: '인증 정보가 없으면', credential: 'guest' },
        { condition: '토큰이 잘못되었으면', credential: 'invalid' }
    ] as const)('$condition', ({ credential }) => {
        let headers: Record<string, string>
        let session: Awaited<ReturnType<typeof loginUser>>
        beforeEach(async () => {
            session = await loginUser(fix, credentials)
            headers = { guest: {}, invalid: { Authorization: 'Bearer invalid-token' } }[credential]
        })
        it('본인 정보 조회에 401을 반환한다', async () => {
            await fix.httpClient
                .get('/users/me')
                .headers(headers)
                .unauthorized({ expected: expectedErrors.unauthorized })
        })
        it('본인 정보 수정에 401을 반환하고 사용자 정보를 유지한다', async () => {
            await fix.httpClient
                .patch('/users/me')
                .headers(headers)
                .body({ name: 'denied' })
                .unauthorized({ expected: expectedErrors.unauthorized })
            await expectCurrentUser(fix, session)
        })
        it('탈퇴 요청에 401을 반환하고 사용자와 로그인 세션을 유지한다', async () => {
            await fix.httpClient
                .delete('/users/me')
                .headers(headers)
                .unauthorized({ expected: expectedErrors.unauthorized })
            await expectCurrentUser(fix, session)
            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: session.refreshToken })
                .ok()
        })
    })

    describe('서로 다른 두 사용자가 로그인했으면', () => {
        let mine: Awaited<ReturnType<typeof loginUser>>
        let other: Awaited<ReturnType<typeof loginUser>>
        let headers: { Authorization: string }
        beforeEach(async () => {
            mine = await loginUser(fix, credentials)
            const otherCredentials = { ...credentials, email: 'other-user@mail.com' }
            await createUser(fix, otherCredentials)
            other = await loginUser(fix, otherCredentials)
            headers = { Authorization: `Bearer ${mine.accessToken}` }
        })
        it('타인 ID를 조회 조건으로 보내도 본인 정보를 반환한다', async () => {
            await fix.httpClient
                .get('/users/me')
                .headers(headers)
                .query({ userId: other.user.id })
                .ok({ schema: UserSchema, expected: mine.user })
        })
        describe('수정 본문에 타인 ID를 넣었으면', () => {
            it('수정을 거절하고 두 사용자의 정보를 유지한다', async () => {
                const bodyWithOtherUserId = {
                    id: other.user.id,
                    userId: other.user.id,
                    name: 'denied'
                }

                await fix.httpClient
                    .patch('/users/me')
                    .headers(headers)
                    .body(bodyWithOtherUserId)
                    .badRequest()
                await expectCurrentUser(fix, mine)
                await expectCurrentUser(fix, other)
            })
        })
        it('탈퇴 요청에 타인 ID를 보내도 본인만 삭제하고 타인의 계정과 세션은 유지한다', async () => {
            await fix.httpClient
                .delete('/users/me')
                .headers(headers)
                .query({ userId: other.user.id })
                .noContent()
            await fix.httpClient
                .get('/users/me')
                .headers(headers)
                .notFound({ expected: expectedErrors.multipleDocumentsNotFound([mine.user.id]) })
            await expectCurrentUser(fix, other)
            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: other.refreshToken })
                .ok()
        })
    })

    describe('POST /users/login', () => {
        describe.each([
            { condition: '15자 미만', password: '🌱'.repeat(14) },
            { condition: '128자 초과', password: 'a'.repeat(129) }
        ])('비밀번호 길이가 $condition 범위이면', ({ password }) => {
            const invalidCredentials = { ...credentials, password }

            it('400을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body(invalidCredentials)
                    .badRequest({ expected: expectedErrors.validationFailed(expect.any(Array)) })
            })
        })

        describe('이메일의 대소문자와 앞뒤 공백만 등록 정보와 다르면', () => {
            const credentialsWithPaddedEmail = { ...credentials, email: '  USER@MAIL.COM  ' }

            it('같은 사용자의 토큰을 반환한다', async () => {
                const { body } = await fix.httpClient
                    .post('/users/login')
                    .body(credentialsWithPaddedEmail)
                    .ok()
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${body.accessToken}` })
                    .ok({
                        schema: UserSchema,
                        expected: expect.objectContaining({ email: credentials.email })
                    })
            })
        })

        describe.each([
            { label: 'ASCII', prefix: 'a'.repeat(72) },
            { label: '한글', prefix: '가'.repeat(24) },
            { label: '이모지', prefix: '🌱'.repeat(18) }
        ])('72바이트를 넘는 $label 비밀번호로 가입했으면', ({ prefix }) => {
            const email = 'long-password@mail.com'
            beforeEach(async () => {
                await fix.httpClient
                    .post('/users')
                    .body(buildCreateUserDto({ email, password: `${prefix}original` }))
                    .created()
            })
            it('전체 비밀번호가 일치해야 로그인할 수 있다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body({ email, password: `${prefix}original` })
                    .ok()
                await fix.httpClient
                    .post('/users/login')
                    .body({ email, password: `${prefix}different` })
                    .unauthorized({ expected: expectedErrors.unauthorized })
            })
        })

        describe('이메일과 비밀번호가 등록된 사용자 정보와 일치하면', () => {
            it('인증 토큰을 반환한다', async () => {
                const { body } = await fix.httpClient
                    .post('/users/login')
                    .body(credentials)
                    .ok({
                        expected: {
                            accessToken: expect.any(String),
                            refreshToken: expect.any(String)
                        }
                    })

                const { exp, iat } = new JwtService().decode<{ exp: number; iat: number }>(
                    body.accessToken
                )
                const { auth } = fix.module.get(AppConfigService)
                expect(exp - iat).toBe(TimeUtil.toMs(auth.accessTokenExpiration) / 1000)
            })
        })

        describe('비밀번호가 틀리면', () => {
            const credentialsWithWrongPassword = { ...credentials, password: 'incorrect password' }

            it('401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body(credentialsWithWrongPassword)
                    .unauthorized({ expected: expectedErrors.unauthorized })
            })
        })

        describe('등록되지 않은 이메일이면', () => {
            const unregisteredCredentials = { ...credentials, email: 'unknown@mail.com' }

            it('401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body(unregisteredCredentials)
                    .unauthorized({ expected: expectedErrors.unauthorized })
            })
        })

        describe('한 IP의 로그인 실패 횟수가 한도에 도달했으면', () => {
            const blockedIp = '198.51.100.1'
            beforeEach(async () => {
                for (let index = 0; index < IP_FAILURE_LIMIT; index++) {
                    await fix.httpClient
                        .post('/users/login')
                        .headers({ 'X-Forwarded-For': blockedIp })
                        .body({ ...credentials, password: 'incorrect password' })
                        .unauthorized({ expected: expectedErrors.unauthorized })
                }
                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': blockedIp })
                    .body(credentials)
                    .send(HttpStatus.TOO_MANY_REQUESTS, { expected: LOGIN_RATE_LIMITED_ERROR })
            })
            it('다른 IP에서 같은 계정으로 로그인하면 200을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': '198.51.100.2' })
                    .body(credentials)
                    .ok()
            })
        })

        describe('로그인 실패 한도에 한 번 모자란 IP에서 로그인에 성공했으면', () => {
            let ip: string
            beforeEach(async () => {
                ip = '198.51.100.100'

                for (let index = 0; index < IP_FAILURE_LIMIT - 1; index++) {
                    await fix.httpClient
                        .post('/users/login')
                        .headers({ 'X-Forwarded-For': ip })
                        .body({
                            email: `unknown-${index}@mail.com`,
                            password: 'incorrect password'
                        })
                        .unauthorized({ expected: expectedErrors.unauthorized })
                }

                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body(credentials)
                    .ok()
            })
            it('같은 IP에서 잘못된 정보로 로그인을 두 번 요청하면 차례로 401과 429를 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body({ email: 'unknown-next@mail.com', password: 'incorrect password' })
                    .unauthorized({ expected: expectedErrors.unauthorized })

                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body({ email: 'unknown-blocked@mail.com', password: 'incorrect password' })
                    .send(HttpStatus.TOO_MANY_REQUESTS, { expected: LOGIN_RATE_LIMITED_ERROR })
            })
        })

        describe('경로 접두어가 다른 두 앱이 Redis를 공유하고 한 앱에서 해당 IP의 로그인 실패 횟수가 한도에 도달했으면', () => {
            let replica: AppTestContext | undefined
            beforeEach(async () => {
                replica = undefined
                replica = await createAppTestContext({
                    configureApp: async (app) => {
                        app.setGlobalPrefix('replica')
                    }
                })
                for (let index = 0; index < IP_FAILURE_LIMIT; index++) {
                    await fix.httpClient
                        .post('/users/login')
                        .headers({ 'X-Forwarded-For': '203.0.113.2' })
                        .body({ ...credentials, password: 'incorrect password' })
                        .unauthorized({ expected: expectedErrors.unauthorized })
                }
            })
            afterEach(() => replica?.teardown())
            it('다른 앱에서도 같은 IP의 로그인 요청에 429를 반환한다', async () => {
                await ensure(replica)
                    .httpClient.post('/replica/users/login')
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

            describe('Authorization 헤더에 리프레시 토큰이 있으면', () => {
                it('401을 반환한다', async () => {
                    const refreshTokenHeaders = {
                        Authorization: `Bearer ${authTokens.refreshToken}`
                    }

                    // 두 토큰은 iss/aud가 같아 secret 분리만이 방벽이다 — 이 검증이 무너지면
                    // 수명이 긴 리프레시 토큰이 로그아웃으로도 회수되지 않는 액세스 토큰으로 동작한다.

                    await fix.httpClient
                        .get('/users/me')
                        .headers(refreshTokenHeaders)
                        .unauthorized({ expected: expectedErrors.unauthorized })
                })
            })
        })

        describe('액세스 토큰이 유효하지 않으면', () => {
            const invalidTokenHeaders = { Authorization: 'Bearer invalid-token' }

            it('401을 반환한다', async () => {
                await fix.httpClient
                    .get('/users/me')
                    .headers(invalidTokenHeaders)
                    .unauthorized({ expected: expectedErrors.unauthorized })
            })
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

            it('401을 반환한다', async () => {
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${token}` })
                    .unauthorized({ expected: expectedErrors.unauthorized })
            })
        })
    })

    describe('DELETE /users/me', () => {
        describe('사용자가 로그인했으면', () => {
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
    })

    describe('PATCH /users/me', () => {
        describe('사용자가 로그인했으면', () => {
            let accessToken: string
            let user: UserDto

            beforeEach(async () => {
                ;({ accessToken, user } = await loginUser(fix, credentials))
            })

            it('비밀번호를 변경해도 기존 액세스 토큰으로 본인 정보를 조회할 수 있다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ password: 'updated password' })
                    .ok({ schema: UserSchema })
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ schema: UserSchema, expected: user })
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

        describe('로그인 후 이름만 변경했으면', () => {
            let session: Awaited<ReturnType<typeof loginUser>>
            beforeEach(async () => {
                session = await loginUser(fix, credentials)
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${session.accessToken}` })
                    .body({ name: 'Updated' })
                    .ok({ schema: UserSchema, expected: { ...session.user, name: 'Updated' } })
            })
            it('기존 세션으로 토큰을 갱신할 수 있다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: session.refreshToken })
                    .ok()
            })
        })

        describe('인증 버전 없이 발급한 리프레시 토큰이면', () => {
            let refreshToken: string
            beforeEach(async () => {
                const { user } = await loginUser(fix, credentials)
                const jwt = fix.module.get<JwtAuthService>(JwtAuthService.getName())
                ;({ refreshToken } = await jwt.generateAuthTokens({
                    sub: user.id,
                    email: user.email
                }))
            })
            it('401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .unauthorized({ expected: expectedErrors.refreshTokenInvalid })
            })
        })

        describe('현재 계정 조회가 한 번 실패하면', () => {
            let session: Awaited<ReturnType<typeof loginUser>>
            let failure: Error
            beforeEach(async () => {
                session = await loginUser(fix, credentials)
                failure = new Error('Account database unavailable')
                vi.spyOn(Collection.prototype, 'findOne').mockRejectedValueOnce(failure)
            })
            it('갱신은 실패하고 저장소가 복구되면 같은 토큰으로 다시 갱신할 수 있다', async () => {
                await expect(
                    fix.module.get(UsersService).refreshAuthTokens(session.refreshToken)
                ).rejects.toBe(failure)
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: session.refreshToken })
                    .ok()
            })
        })

        describe('리프레시 토큰이 유효하지 않으면', () => {
            const invalidRefreshBody = { refreshToken: 'invalid-token' }

            it('401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body(invalidRefreshBody)
                    .unauthorized({ expected: expectedErrors.refreshTokenInvalid })
            })
        })
    })

    describe('POST /users/logout', () => {
        let accessToken: string
        let refreshToken: string
        let user: UserDto

        beforeEach(async () => {
            ;({ accessToken, refreshToken, user } = await loginUser(fix, credentials))
        })

        describe('같은 계정에 다른 로그인 세션이 있으면', () => {
            let otherRefreshToken: string
            beforeEach(async () => {
                const otherSession = await loginUser(fix, credentials)
                otherRefreshToken = otherSession.refreshToken
            })
            it('한 세션에서 로그아웃해도 다른 세션의 토큰은 갱신할 수 있다', async () => {
                await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: otherRefreshToken })
                    .ok()
            })
        })

        it('리프레시 토큰 갱신을 거절하고 기존 액세스 토큰으로 본인 조회를 허용한다', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized({ expected: expectedErrors.refreshTokenInvalid })

            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok({ schema: UserSchema, expected: user })
        })

        describe('리프레시 토큰이 유효하지 않으면', () => {
            const invalidRefreshBody = { refreshToken: 'garbage' }

            it('401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/logout')
                    .body(invalidRefreshBody)
                    .unauthorized({ expected: expectedErrors.refreshTokenInvalid })
            })
        })
    })

    describe('POST /users/me/logout-all', () => {
        let headers: { Authorization: string }

        beforeEach(async () => {
            const { accessToken } = await loginUser(fix, credentials)
            headers = { Authorization: `Bearer ${accessToken}` }
        })

        it('유효한 액세스 토큰으로 요청해도 404를 반환한다', async () => {
            await fix.httpClient.post('/users/me/logout-all').headers(headers).notFound()
        })
    })

    describe('같은 IP의 로그인 요청이 모두 한도 확인을 마치고 비밀번호 검증을 기다리면', () => {
        const attemptCount = IP_FAILURE_LIMIT + 1
        let checking: PromiseWithResolvers<void>
        let resume: PromiseWithResolvers<void>
        beforeEach(() => {
            checking = Promise.withResolvers<void>()
            resume = Promise.withResolvers<void>()
            const verify = PasswordHasher.verify.bind(PasswordHasher)
            let arrivals = 0
            vi.spyOn(PasswordHasher, 'verify').mockImplementation(async (...args) => {
                if (++arrivals === attemptCount) checking.resolve()
                await resume.promise
                return verify(...args)
            })
        })
        it('비밀번호가 모두 틀리면 한도만큼 401을 반환하고 한도를 넘긴 한 요청에는 429를 반환한다', async () => {
            const requests = Array.from({ length: attemptCount }, () =>
                fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': '203.0.113.1' })
                    .body({ ...credentials, password: 'incorrect password' })
                    .sendRaw()
            )
            try {
                await Promise.race([
                    checking.promise,
                    Promise.race(requests).then(({ status }) => {
                        throw new Error(
                            `Login returned HTTP ${status} before all requests reached password verification`
                        )
                    })
                ])
            } finally {
                resume.resolve()
                await Promise.allSettled(requests)
            }
            const responses = await Promise.all(requests)
            const outcomes = responses.map(({ status, body }) => ({ status, body }))
            expect(outcomes.filter(({ status }) => status === HttpStatus.UNAUTHORIZED)).toEqual(
                Array.from({ length: IP_FAILURE_LIMIT }, () => ({
                    status: HttpStatus.UNAUTHORIZED,
                    body: expectedErrors.unauthorized
                }))
            )
            expect(outcomes.filter(({ status }) => status !== HttpStatus.UNAUTHORIZED)).toEqual([
                { status: HttpStatus.TOO_MANY_REQUESTS, body: LOGIN_RATE_LIMITED_ERROR }
            ])
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
                .notFound({ expected: expectedErrors.multipleDocumentsNotFound([user.id]) })
        })
        it('기존 액세스 토큰으로 본인 수정을 요청하면 404를 반환한다', async () => {
            await fix.httpClient
                .patch('/users/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ name: 'must-not-change' })
                .notFound({ expected: expectedErrors.documentNotFound(user.id) })
        })
    })

    describe('비밀번호 검증을 통과한 로그인이 토큰 발급을 기다리면', () => {
        let session: Awaited<ReturnType<typeof loginUser>>
        let resumeLogin: ResumeRequest<{ body: JwtAuthTokens }> | undefined

        beforeEach(async () => {
            resumeLogin = undefined
            session = await loginUser(fix, credentials)
            resumeLogin = await pauseNextTokenIssue(() =>
                fix.httpClient.post('/users/login').body(credentials).ok<JwtAuthTokens>()
            )
        })
        afterEach(async () => {
            await resumeLogin?.()
        })

        it('비밀번호를 변경하면 변경 전에 인증된 로그인 세션으로 갱신할 수 없다', async () => {
            await fix.httpClient
                .patch('/users/me')
                .headers({ Authorization: `Bearer ${session.accessToken}` })
                .body({ password: 'updated password' })
                .ok({ schema: UserSchema, expected: session.user })
            const { body } = await ensure(resumeLogin)()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: session.refreshToken })
                .unauthorized({ expected: expectedErrors.refreshTokenInvalid })

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: body.refreshToken })
                .unauthorized({ expected: expectedErrors.refreshTokenInvalid })

            const current = await loginUser(fix, { ...credentials, password: 'updated password' })
            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: current.refreshToken })
                .ok()
        })

        it('계정을 삭제하면 삭제 전에 인증된 로그인 세션으로 갱신할 수 없다', async () => {
            await fix.httpClient
                .delete('/users/me')
                .headers({ Authorization: `Bearer ${session.accessToken}` })
                .noContent()
            const { body } = await ensure(resumeLogin)()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: session.refreshToken })
                .unauthorized({ expected: expectedErrors.refreshTokenInvalid })

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: body.refreshToken })
                .unauthorized({ expected: expectedErrors.refreshTokenInvalid })
        })
    })

    describe('계정 변경 후 리프레시 세션 회수에 실패하도록 설정하면', () => {
        let session: Awaited<ReturnType<typeof loginUser>>
        let usersService: UsersService
        let failure: Error

        beforeEach(async () => {
            session = await loginUser(fix, credentials)
            usersService = fix.module.get(UsersService)
            failure = new Error('Redis session revocation failed')
            const redis = fix.module.get<RedisConnection>(
                getRedisConnectionToken(REDIS_CONNECTION_NAME)
            )
            vi.spyOn(redis, 'smembers').mockRejectedValueOnce(failure)
        })

        it('비밀번호 변경이 실패해도 DB에 반영된 새 비밀번호로 로그인할 수 있고 이전 세션은 갱신할 수 없다', async () => {
            const password = 'updated password'
            await expect(usersService.update(session.user.id, { password })).rejects.toBe(failure)
            const { body: current } = await fix.httpClient
                .post('/users/login')
                .body({ ...credentials, password })
                .ok()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: session.refreshToken })
                .unauthorized({ expected: expectedErrors.refreshTokenInvalid })

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: current.refreshToken })
                .ok()
        })

        it('계정 삭제가 실패해도 DB에서 삭제된 계정으로 로그인하거나 이전 세션을 갱신할 수 없다', async () => {
            await expect(usersService.deleteMany([session.user.id])).rejects.toBe(failure)
            await fix.httpClient
                .post('/users/login')
                .body(credentials)
                .unauthorized({ expected: expectedErrors.unauthorized })

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: session.refreshToken })
                .unauthorized({ expected: expectedErrors.refreshTokenInvalid })
        })
    })

    describe('리프레시 토큰 발급이 진행 중이면', () => {
        let session: Awaited<ReturnType<typeof loginUser>>
        let resumeRefresh: ResumeRequest<unknown> | undefined
        beforeEach(async () => {
            resumeRefresh = undefined
            session = await loginUser(fix, credentials)
            resumeRefresh = await pauseNextTokenIssue(() =>
                fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: session.refreshToken })
                    .unauthorized({ expected: expectedErrors.refreshTokenInvalid })
            )
        })
        afterEach(async () => {
            await resumeRefresh?.()
        })
        it('비밀번호를 변경하면 진행 중인 갱신 요청에 401을 반환하고 기존 액세스 토큰으로 본인 정보를 조회할 수 있다', async () => {
            await fix.httpClient
                .patch('/users/me')
                .headers({ Authorization: `Bearer ${session.accessToken}` })
                .body({ password: 'updated password' })
                .ok({ schema: UserSchema, expected: session.user })
            await ensure(resumeRefresh)()
            await expectCurrentUser(fix, session)
        })
        it('해당 세션에서 로그아웃하면 진행 중인 갱신 요청에 401을 반환하고 기존 액세스 토큰으로 본인 정보를 조회할 수 있다', async () => {
            await fix.httpClient
                .post('/users/logout')
                .body({ refreshToken: session.refreshToken })
                .noContent()
            await ensure(resumeRefresh)()
            await expectCurrentUser(fix, session)
        })
    })
})
