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
        it('returns auth tokens for valid credentials', async () => {
            await fix.httpClient
                .post('/customers/login')
                .body(fix.credentials)
                .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
        })

        it('returns 401 Unauthorized for incorrect password', async () => {
            await fix.httpClient
                .post('/customers/login')
                .body({ ...fix.credentials, password: 'wrong password' })
                .unauthorized(Errors.Auth.Unauthorized)
        })

        it('returns 401 Unauthorized for unregistered email', async () => {
            await fix.httpClient
                .post('/customers/login')
                .body({ ...fix.credentials, email: 'unknown@mail.com' })
                .unauthorized(Errors.Auth.Unauthorized)
        })
    })

    describe('POST /customers/refresh', () => {
        describe('when the refresh token is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                authTokens = await loginCustomer(fix, fix.credentials)
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

        it('returns 401 Unauthorized for invalid refresh token', async () => {
            await fix.httpClient
                .post('/customers/refresh')
                .body({ refreshToken: 'invalid-token' })
                .unauthorized({
                    ...Errors.JwtAuth.RefreshTokenVerificationFailed,
                    message: 'jwt malformed'
                })
        })
    })

    describe('GET /customers/jwt-guard', () => {
        describe('when the access token is valid', () => {
            let accessToken: string

            beforeEach(async () => {
                const authTokens = await loginCustomer(fix, fix.credentials)
                accessToken = authTokens.accessToken
            })

            it('allows access', async () => {
                await fix.httpClient
                    .get('/customers/jwt-guard')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok()
            })
        })

        it('returns 401 Unauthorized for invalid access token', async () => {
            await fix.httpClient
                .get('/customers/jwt-guard')
                .headers({ Authorization: 'Bearer Invalid-Token' })
                .unauthorized(Errors.Auth.Unauthorized)
        })
    })
})
