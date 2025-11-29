import { Errors } from '../__helpers__'
import type { Fixture } from './customer-auth.fixture'

describe('CustomersService – Authentication', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./customer-auth.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /customers/login', () => {
        describe('when the credentials are valid', () => {
            it('returns access and refresh tokens', async () => {
                await fixture.httpClient
                    .post('/customers/login')
                    .body(fixture.credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        describe('when the password is incorrect', () => {
            it('returns 401 Unauthorized', async () => {
                await fixture.httpClient
                    .post('/customers/login')
                    .body({ ...fixture.credentials, password: 'wrong password' })
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
            it('returns new access and refresh tokens', async () => {
                const { accessToken, refreshToken } = fixture.authTokens

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
            it('allows access', async () => {
                const { accessToken } = fixture.authTokens

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
