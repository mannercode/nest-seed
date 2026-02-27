import type { JwtAuthTokens } from 'common'
import { createCustomer } from 'apps/__tests__/__helpers__'
import { Errors, loginCustomer } from 'apps/__tests__/__helpers__'
import type { CustomerAuthFixture } from './customer-auth.fixture'

describe('CustomerAuth', () => {
    let fix: CustomerAuthFixture
    const credentials = { email: 'user@mail.com', password: 'password' }

    beforeEach(async () => {
        const { createCustomerAuthFixture } = await import('./customer-auth.fixture')
        fix = await createCustomerAuthFixture()

        await createCustomer(fix, credentials)
    })
    afterEach(() => fix.teardown())

    describe('POST /customers/login', () => {
        // 자격 증명이 유효할 때
        describe('when the credentials are valid', () => {
            // 인증 토큰을 반환한다
            it('returns auth tokens', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body(credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        // 비밀번호가 올바르지 않을 때
        describe('when the password is incorrect', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })

        // 이메일이 등록되지 않았을 때
        describe('when the email is not registered', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...credentials, email: 'unknown@mail.com' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })

    describe('POST /customers/refresh', () => {
        // 리프레시 토큰이 유효할 때
        describe('when the refresh token is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginCustomer(fix, credentials)
            })

            // 새 인증 토큰을 반환한다
            it('returns new auth tokens', async () => {
                const { accessToken, refreshToken } = authTokens

                const { body } = await fix.httpClient
                    .post('/customers/refresh')
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
                    .post('/customers/refresh')
                    .body({ refreshToken: 'invalid-token' })
                    .unauthorized(Errors.JwtAuth.RefreshTokenVerificationFailed('jwt malformed'))
            })
        })
    })

    describe('GET /customers/jwt-guard', () => {
        // 액세스 토큰이 유효할 때
        describe('when the access token is valid', () => {
            let accessToken: string

            beforeEach(async () => {
                const loginResult = await loginCustomer(fix, credentials)
                accessToken = loginResult.accessToken
            })

            // 접근을 허용한다
            it('allows access', async () => {
                await fix.httpClient
                    .get('/customers/jwt-guard')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok()
            })
        })

        // 액세스 토큰이 유효하지 않을 때
        describe('when the access token is invalid', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .get('/customers/jwt-guard')
                    .headers({ Authorization: 'Bearer Invalid-Token' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })
})
