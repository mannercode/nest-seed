import { HttpStatus, type INestApplication } from '@nestjs/common'
import { createAdmin, Errors, loginAdmin, type AppTestContext } from '../helpers/index.js'

const ACCOUNT_FAILURE_LIMIT = 5
const IP_FAILURE_LIMIT = 50
const LOGIN_RATE_LIMITED_ERROR = {
    code: 'ERR_AUTH_LOGIN_RATE_LIMITED',
    message: 'Too many login attempts'
}

function trustPrivateProxy(app: INestApplication) {
    app.getHttpAdapter().getInstance().set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
}

describe('AdminAuthentication', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    const credentials = { email: 'admin@mail.com', password: 'password' }

    beforeEach(async () => {
        teardown = undefined
        const { createAppTestContext } = await import('../helpers/index.js')
        fix = await createAppTestContext({ configureApp: async (app) => trustPrivateProxy(app) })
        teardown = fix.teardown

        await createAdmin(fix, credentials)
    })
    afterEach(() => teardown?.())

    describe('POST /admins/login', () => {
        it('자격 증명이 유효하면 인증 토큰을 반환한다', async () => {
            await fix.httpClient
                .post('/admins/login')
                .body(credentials)
                .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
        })

        it('authVersion 필드가 없는 기존 관리자도 version 0 세션으로 로그인한다', async () => {
            const { AdminsRepository } =
                await import('../../services/core/admins/admins.repository.js')
            const repository = fix.module.get(AdminsRepository)
            await repository.model.collection.updateOne(
                { email: credentials.email },
                { $unset: { authVersion: '' } }
            )

            const { body: tokens } = await fix.httpClient
                .post('/admins/login')
                .body(credentials)
                .ok()

            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: `Bearer ${tokens.accessToken}` })
                .ok(expect.objectContaining({ email: credentials.email }))
        })

        it('비밀번호가 틀리면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins/login')
                .body({ ...credentials, password: 'wrong password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('등록되지 않은 이메일이면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins/login')
                .body({ ...credentials, email: 'unknown@mail.com' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('정규화한 계정의 실패가 5회를 넘으면 429를 반환한다', async () => {
            for (let index = 0; index < ACCOUNT_FAILURE_LIMIT; index++) {
                await fix.httpClient
                    .post('/admins/login')
                    .headers({ 'X-Forwarded-For': `198.51.100.${index + 1}` })
                    .body({
                        email: index % 2 === 0 ? 'ADMIN@mail.com' : 'admin@MAIL.com',
                        password: 'wrong password'
                    })
                    .unauthorized(Errors.Auth.Unauthorized())
            }

            await fix.httpClient
                .post('/admins/login')
                .headers({ 'X-Forwarded-For': '198.51.100.6' })
                .body({ ...credentials, password: 'wrong password' })
                .send(HttpStatus.TOO_MANY_REQUESTS, LOGIN_RATE_LIMITED_ERROR)
        })

        it('성공하면 정규화한 계정의 실패 횟수를 초기화한다', async () => {
            for (let index = 0; index < ACCOUNT_FAILURE_LIMIT - 1; index++) {
                await fix.httpClient
                    .post('/admins/login')
                    .headers({ 'X-Forwarded-For': `203.0.113.${index + 1}` })
                    .body({
                        email: index % 2 === 0 ? 'ADMIN@mail.com' : 'admin@MAIL.com',
                        password: 'wrong password'
                    })
                    .unauthorized(Errors.Auth.Unauthorized())
            }

            await fix.httpClient
                .post('/admins/login')
                .headers({ 'X-Forwarded-For': '203.0.113.5' })
                .body(credentials)
                .ok()

            for (let index = 0; index < ACCOUNT_FAILURE_LIMIT; index++) {
                await fix.httpClient
                    .post('/admins/login')
                    .headers({ 'X-Forwarded-For': `192.0.2.${index + 1}` })
                    .body({ ...credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized())
            }

            await fix.httpClient
                .post('/admins/login')
                .headers({ 'X-Forwarded-For': '192.0.2.6' })
                .body({ ...credentials, password: 'wrong password' })
                .send(HttpStatus.TOO_MANY_REQUESTS, LOGIN_RATE_LIMITED_ERROR)
        })

        it('성공해도 IP 실패 횟수는 초기화하지 않고 51번째 요청부터 429를 반환한다', async () => {
            const ip = '198.51.100.100'

            for (let index = 0; index < IP_FAILURE_LIMIT - 1; index++) {
                await fix.httpClient
                    .post('/admins/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body({ email: `unknown-${index}@mail.com`, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized())
            }

            await fix.httpClient
                .post('/admins/login')
                .headers({ 'X-Forwarded-For': ip })
                .body(credentials)
                .ok()

            await fix.httpClient
                .post('/admins/login')
                .headers({ 'X-Forwarded-For': ip })
                .body({ email: 'unknown-50@mail.com', password: 'wrong password' })
                .unauthorized(Errors.Auth.Unauthorized())

            await fix.httpClient
                .post('/admins/login')
                .headers({ 'X-Forwarded-For': ip })
                .body({ email: 'unknown-51@mail.com', password: 'wrong password' })
                .send(HttpStatus.TOO_MANY_REQUESTS, LOGIN_RATE_LIMITED_ERROR)
        })
    })

    describe('GET /admins/me', () => {
        it('유효한 액세스 토큰이면 admin DTO를 반환한다', async () => {
            const tokens = await loginAdmin(fix, credentials)

            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: `Bearer ${tokens.accessToken}` })
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
                .get('/admins/me')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('POST /admins/refresh', () => {
        it('유효한 리프레시 토큰이면 새 토큰을 반환한다', async () => {
            const { accessToken, refreshToken } = await loginAdmin(fix, credentials)

            const { body } = await fix.httpClient
                .post('/admins/refresh')
                .body({ refreshToken })
                .ok()

            expect(body.accessToken).not.toEqual(accessToken)
            expect(body.refreshToken).not.toEqual(refreshToken)
        })
    })

    describe('POST /admins/logout', () => {
        let refreshToken: string

        beforeEach(async () => {
            ;({ refreshToken } = await loginAdmin(fix, credentials))
        })

        it('로그아웃하면 204를 반환한다', async () => {
            await fix.httpClient.post('/admins/logout').body({ refreshToken }).noContent()
        })

        it('로그아웃한 refresh 토큰을 다시 쓰면 401을 반환한다', async () => {
            await fix.httpClient.post('/admins/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/admins/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })
    })
})
