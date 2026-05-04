import type { JwtAuthTokens } from '@mannercode/common'
import type { UserAuthFixture } from './user-auth.fixture'
import { createUser, Errors, loginUser } from '../__helpers__'

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
        // 자격 증명이 유효할 때
        describe('when the credentials are valid', () => {
            // 인증 토큰을 반환한다
            it('returns auth tokens', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body(credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        // 비밀번호가 올바르지 않을 때
        describe('when the password is incorrect', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body({ ...credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })

        // 이메일이 등록되지 않았을 때
        describe('when the email is not registered', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body({ ...credentials, email: 'unknown@mail.com' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })

    describe('GET /users/me', () => {
        // 액세스 토큰이 유효할 때
        describe('when the access token is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginUser(fix, credentials)
            })

            // 현재 고객 정보(User DTO)를 반환한다 — JWT payload 가 아닌 도메인 DTO
            it('returns the current user info', async () => {
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
        })

        // 액세스 토큰이 유효하지 않을 때
        describe('when the access token is invalid', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: 'Bearer invalid-token' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })

    describe('GET /users', () => {
        // 액세스 토큰이 유효하지 않을 때
        describe('when the access token is invalid', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .get('/users')
                    .headers({ Authorization: 'Bearer invalid-token' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })

    describe('POST /users/refresh', () => {
        // 리프레시 토큰이 유효할 때
        describe('when the refresh token is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginUser(fix, credentials)
            })

            // 새 인증 토큰을 반환한다
            it('returns new auth tokens', async () => {
                const { accessToken, refreshToken } = authTokens

                const { body } = await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .ok()

                expect(body.accessToken).not.toEqual(accessToken)
                expect(body.refreshToken).not.toEqual(refreshToken)
            })
        })

        // 리프레시 토큰이 유효하지 않을 때
        describe('when the refresh token is invalid', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: 'invalid-token' })
                    .unauthorized(Errors.JwtAuth.RefreshTokenVerificationFailed('jwt malformed'))
            })
        })
    })

    describe('POST /users/logout', () => {
        // 정상 로그아웃 — 204 + 이후 refresh 불가
        it('revokes the refresh token: subsequent refresh fails', async () => {
            const { refreshToken } = await loginUser(fix, credentials)

            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })

        // 잘못된 토큰으로 logout 호출해도 204 (best-effort)
        it('returns 204 even for a malformed token', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken: 'garbage' }).noContent()
        })
    })

    describe('POST /users/me/logout-all', () => {
        // 두 디바이스 로그인 후 logout-all → 양쪽 모두 refresh 불가
        it('revokes every active session for the caller', async () => {
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

        // 인증 없이 호출하면 401
        it('returns 401 without an access token', async () => {
            await fix.httpClient.post('/users/me/logout-all').unauthorized()
        })
    })
})
