import type { UserAuthFixture } from './user-auth.fixture'
import { createUser, Errors, loginUser } from '../helpers'

describe('UserAuthentication', () => {
    let fix: UserAuthFixture
    const credentials = { email: 'user@mail.com', password: 'password' }

    beforeEach(async () => {
        const { createUserAuthFixture } = await import('./user-auth.fixture')
        fix = await createUserAuthFixture()

        await createUser(fix, credentials)
    })
    afterEach(() => fix.teardown())

    describe('POST /users/login', () => {
        it('자격 증명이 유효하면 인증 토큰을 반환한다', async () => {
            await fix.httpClient
                .post('/users/login')
                .body(credentials)
                .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
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
    })

    describe('GET /users/me', () => {
        it('유효한 access 토큰이면 현재 고객의 도메인 DTO를 반환한다', async () => {
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

        it('access 토큰이 유효하지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('GET /users', () => {
        it('access 토큰이 유효하지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('POST /users/refresh', () => {
        it('유효한 refresh 토큰이면 새 인증 토큰을 반환한다', async () => {
            const { accessToken, refreshToken } = await loginUser(fix, credentials)

            const { body } = await fix.httpClient.post('/users/refresh').body({ refreshToken }).ok()

            expect(body.accessToken).not.toEqual(accessToken)
            expect(body.refreshToken).not.toEqual(refreshToken)
        })

        it('refresh 토큰이 유효하지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: 'invalid-token' })
                .unauthorized(Errors.JwtAuth.RefreshTokenVerificationFailed('jwt malformed'))
        })
    })

    describe('POST /users/logout', () => {
        it('로그아웃하면 204를 반환하고 이후 refresh가 차단된다', async () => {
            const { refreshToken } = await loginUser(fix, credentials)

            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })

        it('잘못된 토큰으로 로그아웃해도 204를 반환한다', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken: 'garbage' }).noContent()
        })
    })

    describe('POST /users/me/logout-all', () => {
        it('전체 로그아웃 시 모든 디바이스의 refresh가 차단된다', async () => {
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
    })
})
