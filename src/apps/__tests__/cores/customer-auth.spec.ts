import { CustomerDto } from 'apps/cores'
import { JwtAuthTokens } from 'common'
import { createCustomer, Errors, generateAuthTokens } from '../__helpers__'
import type { CustomerAuthFixture } from './customer-auth.fixture'

describe('CustomersService - Authentication', () => {
    let fixture: CustomerAuthFixture

    beforeEach(async () => {
        const { createCustomerAuthFixture } = await import('./customer-auth.fixture')
        fixture = await createCustomerAuthFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    const credentials = { email: 'user@mail.com', password: 'password' }

    describe('POST /customers/login', () => {
        describe('when the credentials are valid', () => {
            beforeEach(async () => {
                await createCustomer(fixture, credentials)
            })

            it('returns access and refresh tokens', async () => {
                await fixture.httpClient
                    .post('/customers/login')
                    .body(credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        describe('when the password is incorrect', () => {
            beforeEach(async () => {
                await createCustomer(fixture, credentials)
            })

            it('returns 401 Unauthorized', async () => {
                await fixture.httpClient
                    .post('/customers/login')
                    .body({ ...credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })

        describe('when the email does not exist', () => {
            it('returns 401 Unauthorized', async () => {
                await fixture.httpClient
                    .post('/customers/login')
                    .body({ email: 'unknown@mail.com', password: '-' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })

    describe('POST /customers/refresh', () => {
        describe('when the refresh token is valid', () => {
            let authTokens: JwtAuthTokens

            beforeEach(async () => {
                const customer: CustomerDto = await createCustomer(fixture, credentials)
                authTokens = await generateAuthTokens(fixture, customer)
            })

            it('returns new access and refresh tokens', async () => {
                const { accessToken, refreshToken } = authTokens

                const { body } = await fixture.httpClient
                    .post('/customers/refresh')
                    .body({ refreshToken })
                    .ok()

                expect(body.accessToken).not.toEqual(accessToken)
                expect(body.refreshToken).not.toEqual(refreshToken)
            })
        })

        describe('when the refresh token is invalid', () => {
            it('returns 401 Unauthorized', async () => {
                await fixture.httpClient
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
            let accessToken: string

            beforeEach(async () => {
                const customer: CustomerDto = await createCustomer(fixture, credentials)
                const authTokens = await generateAuthTokens(fixture, customer)
                accessToken = authTokens.accessToken
            })

            it('allows access', async () => {
                await fixture.httpClient
                    .get('/customers/jwtGuard')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ message: 'accessToken is valid' })
            })
        })

        describe('when the access token is invalid', () => {
            it('returns 401 Unauthorized', async () => {
                await fixture.httpClient
                    .get('/customers/jwtGuard')
                    .headers({ Authorization: 'Bearer Invalid-Token' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })
})
