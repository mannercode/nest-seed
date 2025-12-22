import { createCustomer } from '../__helpers__'
import { Errors, loginCustomer } from '../__helpers__'
import type { CustomerAuthFixture } from './customer-auth.fixture'
import type { JwtAuthTokens } from 'common'

describe('CustomersService', () => {
    let fix: CustomerAuthFixture
    const credentials = { email: 'user@mail.com', password: 'password' }

    beforeEach(async () => {
        const { createCustomerAuthFixture } = await import('./customer-auth.fixture')
        fix = await createCustomerAuthFixture()

        await createCustomer(fix, credentials)
    })
    afterEach(() => fix.teardown())

    describe('POST /customers/login', () => {
        describe('when the credentials are valid', () => {
            it('returns auth tokens', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body(credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        describe('when the password is incorrect', () => {
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })

        describe('when the email is not registered', () => {
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...credentials, email: 'unknown@mail.com' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })

    describe('POST /customers/refresh', () => {
        describe('when the refresh token is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginCustomer(fix, credentials)
            })

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

    describe('GET /customers/jwt-guard', () => {
        describe('when the access token is valid', () => {
            let accessToken: string

            beforeEach(async () => {
                const authTokens = await loginCustomer(fix, credentials)
                accessToken = authTokens.accessToken
            })

            it('allows access', async () => {
                await fix.httpClient
                    .get('/customers/jwt-guard')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok()
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
