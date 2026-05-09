import type { JwtAuthTokens } from '@mannercode/common'
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
        describe('자격 증명이 유효할 때', () => {
            it('인증 토큰을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body(credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        describe('비밀번호가 올바르지 않을 때', () => {
            it('401 Unauthorized를 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body({ ...credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })

        describe('이메일이 등록되지 않았을 때', () => {
            it('401 Unauthorized를 반환한다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body({ ...credentials, email: 'unknown@mail.com' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })

    describe('GET /users/me', () => {
        describe('액세스 토큰이 유효할 때', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginUser(fix, credentials)
            })

            it('현재 고객 정보(User DTO)를 반환한다 — JWT payload 가 아닌 도메인 DTO', async () => {
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

        describe('액세스 토큰이 유효하지 않을 때', () => {
            it('401 Unauthorized를 반환한다', async () => {
                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: 'Bearer invalid-token' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })

    describe('GET /users', () => {
        describe('액세스 토큰이 유효하지 않을 때', () => {
            it('401 Unauthorized를 반환한다', async () => {
                await fix.httpClient
                    .get('/users')
                    .headers({ Authorization: 'Bearer invalid-token' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })

    describe('POST /users/refresh', () => {
        describe('리프레시 토큰이 유효할 때', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginUser(fix, credentials)
            })

            it('새 인증 토큰을 반환한다', async () => {
                const { accessToken, refreshToken } = authTokens

                const { body } = await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .ok()

                expect(body.accessToken).not.toEqual(accessToken)
                expect(body.refreshToken).not.toEqual(refreshToken)
            })
        })

        describe('리프레시 토큰이 유효하지 않을 때', () => {
            it('401 Unauthorized를 반환한다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken: 'invalid-token' })
                    .unauthorized(Errors.JwtAuth.RefreshTokenVerificationFailed('jwt malformed'))
            })
        })
    })

    describe('POST /users/logout', () => {
        it('정상 로그아웃 — 204 + 이후 refresh 불가', async () => {
            const { refreshToken } = await loginUser(fix, credentials)

            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })

        it('잘못된 토큰으로 logout 호출해도 204 (best-effort)', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken: 'garbage' }).noContent()
        })
    })

    describe('POST /users/me/logout-all', () => {
        it('두 디바이스 로그인 후 logout-all → 양쪽 모두 refresh 불가', async () => {
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

        it('인증 없이 호출하면 401', async () => {
            await fix.httpClient.post('/users/me/logout-all').unauthorized()
        })
    })
})
