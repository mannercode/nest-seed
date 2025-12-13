import { JwtAuthTokens } from 'common'
import { Errors, loginCustomer } from '../__helpers__'
import type { CustomerAuthFixture } from './customer-auth.fixture'

describe('CustomersService', () => {
    let fix: CustomerAuthFixture

    beforeEach(async () => {
        const { createCustomerAuthFixture } = await import('./customer-auth.fixture')
        fix = await createCustomerAuthFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /customers/login', () => {
        describe('when the email and password are valid', () => {
            it('returns 200 with accessToken and refreshToken', async () => {
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

        describe('when the email is not registered', () => {
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...fix.credentials, email: 'unknown@mail.com' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })

    describe('POST /customers/refresh', () => {
        describe('when the refreshToken is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginCustomer(fix, fix.credentials)
            })

            it('returns 200 with new accessToken and refreshToken', async () => {
                const { accessToken, refreshToken } = authTokens

                const { body } = await fix.httpClient
                    .post('/customers/refresh')
                    .body({ refreshToken })
                    .ok()

                expect(body.accessToken).not.toEqual(accessToken)
                expect(body.refreshToken).not.toEqual(refreshToken)
            })
        })

        describe('when the refreshToken is invalid', () => {
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
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginCustomer(fix, fix.credentials)
            })

            it('returns 200 OK', async () => {
                await fix.httpClient
                    .get('/customers/jwt-guard')
                    .headers({ Authorization: `Bearer ${authTokens.accessToken}` })
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
