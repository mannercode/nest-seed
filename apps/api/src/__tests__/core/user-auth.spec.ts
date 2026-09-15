import { oid } from '@mannercode/testing'
import { HttpStatus, type INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from '#config'
import { type UserDto, UsersService } from '#core'
import {
    createPurchaseRecord,
    createUser,
    Errors,
    loginUser,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { LoginRateLimiterService } from '#gateway'
import { JwtAuthService, TimeUtil } from '@mannercode/common'

const ACCOUNT_FAILURE_LIMIT = 5
const IP_FAILURE_LIMIT = 50
const LOGIN_RATE_LIMITED_ERROR = {
    code: 'ERR_AUTH_LOGIN_RATE_LIMITED',
    message: 'Too many login attempts'
}

function trustPrivateProxy(app: INestApplication) {
    app.getHttpAdapter().getInstance().set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
}

type TokenIssueResult = {
    refreshTokenId: string
    tokens: { accessToken: string; refreshToken: string }
}

type JwtAuthInternals = {
    issueTokensInFamily(
        payload: object,
        familyId: string,
        userId: string | undefined
    ): Promise<TokenIssueResult>
}

function pauseNextTokenIssue(jwtAuthService: object) {
    const internals = jwtAuthService as JwtAuthInternals
    const issueTokens = internals.issueTokensInFamily.bind(internals)
    let announceStarted!: () => void
    let release!: () => void
    const started = new Promise<void>((resolve) => (announceStarted = resolve))
    const held = new Promise<void>((resolve) => (release = resolve))

    vi.spyOn(internals, 'issueTokensInFamily').mockImplementationOnce(
        async (payload, familyId, userId) => {
            announceStarted()
            await held
            return issueTokens(payload, familyId, userId)
        }
    )

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
                .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })

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
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('등록되지 않은 이메일이면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/login')
                .body({ ...credentials, email: 'unknown@mail.com' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('정규화한 계정의 실패를 Redis에서 공유하고 6번째 요청부터 429를 반환한다', async () => {
            const replica = await createAppTestContext({
                configureApp: async (app) => trustPrivateProxy(app)
            })

            try {
                for (let index = 0; index < ACCOUNT_FAILURE_LIMIT; index++) {
                    const ctx = index % 2 === 0 ? fix : replica
                    const email = index % 2 === 0 ? 'USER@mail.com' : 'user@MAIL.com'

                    await ctx.httpClient
                        .post('/users/login')
                        .headers({ 'X-Forwarded-For': `198.51.100.${index + 1}` })
                        .body({ email, password: 'wrong password' })
                        .unauthorized(Errors.Auth.Unauthorized())
                }

                await replica.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': '198.51.100.6' })
                    .body({ ...credentials, password: 'wrong password' })
                    .send(HttpStatus.TOO_MANY_REQUESTS, LOGIN_RATE_LIMITED_ERROR)
            } finally {
                await replica.teardown()
            }
        })

        it('동시 요청이 사전 검사를 함께 통과해도 증가 후 한도 초과 요청은 429로 끝낸다', async () => {
            const rateLimiter = fix.module.get(LoginRateLimiterService)

            const results = await Promise.allSettled(
                Array.from({ length: ACCOUNT_FAILURE_LIMIT + 1 }, (_, index) =>
                    rateLimiter.recordFailure('user', credentials.email, `203.0.113.${index + 1}`)
                )
            )
            const rejected = results.filter((result) => result.status === 'rejected')

            expect(rejected).toHaveLength(1)
            expect(rejected[0]).toMatchObject({
                reason: { response: LOGIN_RATE_LIMITED_ERROR, status: HttpStatus.TOO_MANY_REQUESTS }
            })
        })

        it('성공하면 정규화한 계정의 실패 횟수를 초기화한다', async () => {
            for (let index = 0; index < ACCOUNT_FAILURE_LIMIT - 1; index++) {
                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': `203.0.113.${index + 1}` })
                    .body({
                        email: index % 2 === 0 ? 'USER@mail.com' : 'user@MAIL.com',
                        password: 'wrong password'
                    })
                    .unauthorized(Errors.Auth.Unauthorized())
            }

            await fix.httpClient
                .post('/users/login')
                .headers({ 'X-Forwarded-For': '203.0.113.5' })
                .body(credentials)
                .ok()

            for (let index = 0; index < ACCOUNT_FAILURE_LIMIT; index++) {
                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': `192.0.2.${index + 1}` })
                    .body({ ...credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized())
            }

            await fix.httpClient
                .post('/users/login')
                .headers({ 'X-Forwarded-For': '192.0.2.6' })
                .body({ ...credentials, password: 'wrong password' })
                .send(HttpStatus.TOO_MANY_REQUESTS, LOGIN_RATE_LIMITED_ERROR)
        })

        it('성공해도 IP 실패 횟수는 초기화하지 않고 51번째 요청부터 429를 반환한다', async () => {
            const ip = '198.51.100.100'

            for (let index = 0; index < IP_FAILURE_LIMIT - 1; index++) {
                await fix.httpClient
                    .post('/users/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body({ email: `unknown-${index}@mail.com`, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized())
            }

            await fix.httpClient
                .post('/users/login')
                .headers({ 'X-Forwarded-For': ip })
                .body(credentials)
                .ok()

            await fix.httpClient
                .post('/users/login')
                .headers({ 'X-Forwarded-For': ip })
                .body({ email: 'unknown-50@mail.com', password: 'wrong password' })
                .unauthorized(Errors.Auth.Unauthorized())

            await fix.httpClient
                .post('/users/login')
                .headers({ 'X-Forwarded-For': ip })
                .body({ email: 'unknown-51@mail.com', password: 'wrong password' })
                .send(HttpStatus.TOO_MANY_REQUESTS, LOGIN_RATE_LIMITED_ERROR)
        })
    })

    describe('GET /users/me', () => {
        it('유효한 액세스 토큰이면 현재 고객의 도메인 DTO를 반환한다', async () => {
            const authTokens = await loginUser(fix, credentials)

            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${authTokens.accessToken}` })
                .ok(
                    expect.objectContaining({
                        id: expect.any(String),
                        email: credentials.email,
                        name: expect.any(String)
                    })
                )
        })

        it('액세스 토큰이 검증되지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it.each([{ email: 'user@mail.com' }, { email: 'invalid', sub: 'user-id' }])(
            '서명이 유효해도 필수 claim이 올바르지 않으면 401을 반환한다: %j',
            async (payload) => {
                const { auth } = fix.module.get(AppConfigService)
                const token = await new JwtService().signAsync(payload, {
                    audience: auth.audience,
                    issuer: auth.issuer,
                    secret: auth.accessSecret,
                    expiresIn: '5m'
                })

                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${token}` })
                    .unauthorized(Errors.Auth.Unauthorized())
            }
        )

        it('리프레시 토큰을 액세스 토큰 자리에 쓰면 401을 반환한다', async () => {
            // 두 토큰은 iss/aud가 같아 secret 분리만이 방벽이다 — 이 검증이 무너지면
            // 수명이 긴 리프레시 토큰이 로그아웃으로도 회수되지 않는 액세스 토큰으로 동작한다.
            const { refreshToken } = await loginUser(fix, credentials)

            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${refreshToken}` })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('DELETE /users/me', () => {
        describe('로그인했을 때', () => {
            let accessToken: string
            let user: UserDto

            beforeEach(async () => {
                ;({ accessToken, user } = await loginUser(fix, credentials))
            })

            it('204를 반환한다', async () => {
                await fix.httpClient
                    .delete('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .noContent()
            })

            it('삭제 후에도 인증은 통과하지만 본인 조회는 자원이 없어 404를 반환한다', async () => {
                await fix.httpClient
                    .delete('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .noContent()
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .notFound(Errors.Mongo.MultipleDocumentsNotFound([user.id]))
            })

            it('삭제 후에도 인증은 통과하지만 본인 수정은 자원이 없어 404를 반환한다', async () => {
                await fix.httpClient
                    .delete('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .noContent()
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ name: 'must-not-change' })
                    .notFound(Errors.Mongo.DocumentNotFound(user.id))
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
                    .ok({ ...user, ...updateDto })
            })

            it('수정 내용이 DB에 저장된다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(updateDto)
                    .ok()

                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ ...user, ...updateDto })
            })

            it('password를 바꿔도 기존 액세스 토큰은 만료 전까지 인증을 통과한다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ password: 'newPassword' })
                    .ok()
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok(user)
            })

            it('리프레시 발급 전에 password가 바뀌면 회수된 세션의 재발급을 거부한다', async () => {
                const session = await loginUser(fix, credentials)
                const jwtAuthService = fix.module.get(JwtAuthService.getName())
                const usersService = fix.module.get(UsersService)
                const gate = pauseNextTokenIssue(jwtAuthService)
                const refreshResult = Promise.allSettled([
                    usersService.refreshAuthTokens(session.refreshToken)
                ])
                await gate.started
                try {
                    await usersService.update(session.user.id, { password: 'newPassword' })
                } finally {
                    gate.release()
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
                    .ok(session.user)
            })
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.patch('/users/me').body({ name: 'x' }).unauthorized()
        })
    })

    describe('GET /users/me/purchases', () => {
        it('본인 구매 기록만 반환한다', async () => {
            const { accessToken, user } = await loginUser(fix, credentials)

            // 본인 기록 둘과 타인 기록 하나를 심어, 토큰 주체의 것만 조회되는지 본다.
            const mine1 = await createPurchaseRecord(fix, { userId: user.id })
            const mine2 = await createPurchaseRecord(fix, { userId: user.id })
            await createPurchaseRecord(fix, { userId: oid(0xff) })

            const { body } = await fix.httpClient
                .get('/users/me/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok()

            expect(body).toEqual(expect.arrayContaining([mine1, mine2]))
            expect(body).toHaveLength(2)
            expect(body.every((record: { userId: string }) => record.userId === user.id)).toBe(true)
        })

        it('구매 기록이 없으면 빈 배열을 반환한다', async () => {
            const { accessToken } = await loginUser(fix, credentials)

            await fix.httpClient
                .get('/users/me/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok([])
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.get('/users/me/purchases').unauthorized()
        })
    })

    describe('POST /users/refresh', () => {
        it('유효한 리프레시 토큰이면 새 인증 토큰을 반환한다', async () => {
            const { accessToken, refreshToken } = await loginUser(fix, credentials)

            const { body } = await fix.httpClient.post('/users/refresh').body({ refreshToken }).ok()

            expect(body.accessToken).not.toEqual(accessToken)
            expect(body.refreshToken).not.toEqual(refreshToken)
        })

        it('리프레시 토큰이 검증되지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: 'invalid-token' })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
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

        it('로그아웃 후 리프레시는 차단하고 액세스 토큰은 만료 전까지 허용한다', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())

            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok(user)
        })

        it('잘못된 토큰으로 로그아웃하면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/logout')
                .body({ refreshToken: 'garbage' })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })
    })

    describe('POST /users/me/logout-all', () => {
        it('전체 로그아웃 시 모든 디바이스의 리프레시가 차단된다', async () => {
            const sessionA = await loginUser(fix, credentials)
            const sessionB = await loginUser(fix, credentials)

            await fix.httpClient
                .post('/users/me/logout-all')
                .headers({ Authorization: `Bearer ${sessionA.accessToken}` })
                .noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: sessionA.refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: sessionB.refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.post('/users/me/logout-all').unauthorized()
        })

        it('전체 로그아웃 후에도 기존 액세스 토큰은 만료 전까지 인증을 통과한다', async () => {
            const session = await loginUser(fix, credentials)
            await fix.httpClient
                .post('/users/me/logout-all')
                .headers({ Authorization: `Bearer ${session.accessToken}` })
                .noContent()
            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${session.accessToken}` })
                .ok(session.user)
        })

        it('리프레시 발급 전에 전체 로그아웃하면 회수된 세션의 재발급을 거부한다', async () => {
            const session = await loginUser(fix, credentials)
            const jwtAuthService = fix.module.get(JwtAuthService.getName())
            const usersService = fix.module.get(UsersService)
            const gate = pauseNextTokenIssue(jwtAuthService)
            const refreshResult = Promise.allSettled([
                usersService.refreshAuthTokens(session.refreshToken)
            ])
            await gate.started
            try {
                await usersService.revokeAllForUser(session.user.id)
            } finally {
                gate.release()
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
                .ok(session.user)
        })
    })
})
