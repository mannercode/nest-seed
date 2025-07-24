import { Errors } from '../__helpers__'
import { Fixture } from './customer-auth.fixture'

describe('CustomersService – Authentication', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./customer-auth.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /customers/login', () => {
        // 자격 증명이 유효한 경우
        describe('when the credentials are valid', () => {
            // access/refresh 토큰을 반환한다
            it('returns access and refresh tokens', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body(fix.credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        // 비밀번호가 틀린 경우
        describe('when the password is incorrect', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...fix.credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })

        // 이메일이 존재하지 않는 경우
        describe('when the email does not exist', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized for non‑existent email', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email: 'unknown@mail.com', password: '-' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })

    describe('POST /customers/refresh', () => {
        // 리프레시 토큰이 유효한 경우
        describe('when the refresh token is valid', () => {
            // 새 액세스 토큰과 리프레시 토큰을 반환한다
            it('returns new access and refresh tokens', async () => {
                const { accessToken, refreshToken } = fix.authTokens

                const { body } = await fix.httpClient
                    .post('/customers/refresh')
                    .body({ refreshToken })
                    .ok()

                expect(body.accessToken).not.toEqual(accessToken)
                expect(body.refreshToken).not.toEqual(refreshToken)
            })
        })

        // 리프레시 토큰이 유효하지 않은 경우
        describe('when the refresh token is invalid', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/refresh')
                    .body({ refreshToken: 'invalid-token' })
                    .unauthorized({
                        ...Errors.JwtAuth.RefreshTokenVerificationFailed,
                        message: 'jwt malformed'
                    })
            })
        })
    })

    describe('CustomerJwtAuthGuard', () => {
        // 액세스 토큰이 유효한 경우
        describe('when the access token is valid', () => {
            // 접근을 허용한다
            it('allows access', async () => {
                const { accessToken } = fix.authTokens

                await fix.httpClient
                    .get('/customers/jwtGuard')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ message: 'accessToken is valid' })
            })
        })

        // 액세스 토큰이 유효하지 않은 경우
        describe('when the access token is invalid', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .get('/customers/jwtGuard')
                    .headers({ Authorization: 'Bearer Invalid-Token' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })
})
