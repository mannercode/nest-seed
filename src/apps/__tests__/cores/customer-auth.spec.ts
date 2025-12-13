import { JwtAuthTokens } from 'common'
import { Errors } from '../__helpers__'
import type { CustomerAuthFixture } from './customer-auth.fixture'

describe('CustomersService - Authentication', () => {
    let fix: CustomerAuthFixture

    beforeEach(async () => {
        const { createCustomerAuthFixture } = await import('./customer-auth.fixture')
        fix = await createCustomerAuthFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /customers/login', () => {
        describe('when the credentials are valid', () => {
            it('returns access and refresh tokens', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body(fix.credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        describe('when the password is incorrect', () => {
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...fix.credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })

        describe('when the email does not exist', () => {
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...fix.credentials, email: 'unknown@mail.com' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })

    describe('POST /customers/refresh', () => {
        describe('when the refresh token is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                const { body } = await fix.httpClient
                    .post('/customers/login')
                    .body(fix.credentials)
                    .ok()

                authTokens = body
            })

            it('returns new access and refresh tokens', async () => {
                const { accessToken, refreshToken } = authTokens

                const { body } = await fix.httpClient
                    .post('/customers/refresh')
                    .body({ refreshToken })
                    .ok()

                expect(body.accessToken).not.toEqual(accessToken)
                expect(body.refreshToken).not.toEqual(refreshToken)
            })
        })

        describe('when the refresh token is invalid', () => {
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
        describe('when the access token is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                const { body } = await fix.httpClient
                    .post('/customers/login')
                    .body(fix.credentials)
                    .ok()

                authTokens = body
            })

            it('allows access', async () => {
                await fix.httpClient
                    .get('/customers/jwt-guard')
                    .headers({ Authorization: `Bearer ${authTokens.accessToken}` })
                    .ok({ message: 'accessToken is valid' })
            })
        })

        describe('when the access token is invalid', () => {
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .get('/customers/jwt-guard')
                    .headers({ Authorization: 'Bearer Invalid-Token' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })
})
