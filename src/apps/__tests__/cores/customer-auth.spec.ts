import { CustomerDto } from 'apps/cores'
import { Errors } from '../__helpers__'
import { createCustomer } from '../common.fixture'
import { Fixture } from './customer-auth.fixture'

// 사용자 인증
describe('User Authentication', () => {
    // 자격 증명이 유효한 경우
    context('when the credentials are valid', () => {
        // 로그인한다
        it('logs in', () => {})
    })

    // 자격 증명이 유효하지 않은 경우
    describe('when the credentials are invalid', () => {
        // 비밀번호가 틀린 경우 401 Unauthorized를 반환한다
        it('returns 401 Unauthorized for incorrect password', async () => {})
    })

    // 리프레시 토큰이 유효하지 않은 경우
    describe('when the refresh token is invalid', () => {
        // 401 Unauthorized를 반환한다
        it('returns 401 Unauthorized', async () => {})
    })
})

describe('CustomersService – Authentication', () => {
    let fix: Fixture
    let customer: CustomerDto
    const email = 'user@mail.com'
    const password = 'password'

    beforeEach(async () => {
        const { createFixture } = await import('./customer-auth.fixture')
        fix = await createFixture()
        customer = await createCustomer(fix, { email, password })
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /customers/login', () => {
        // 자격 증명이 유효한 경우
        describe('when the credentials are valid', () => {
            // 로그인한다
            it('logs in', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email, password })
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        // 자격 증명이 유효하지 않은 경우
        describe('when the credentials are invalid', () => {
            // 비밀번호가 틀린 경우 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized for incorrect password', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })

            // 이메일이 존재하지 않는 경우 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized for unknown email', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email: 'unknown@mail.com', password: '.' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })

    describe('POST /customers/refresh', () => {
        let accessToken: string
        let refreshToken: string

        beforeEach(async () => {
            const { body } = await fix.httpClient
                .post('/customers/login')
                .body({ email, password })
                .ok()
            accessToken = body.accessToken
            refreshToken = body.refreshToken
        })

        // 리프레시 토큰이 유효한 경우
        describe('when the refresh token is valid', () => {
            // 새 액세스 토큰과 리프레시 토큰을 반환한다
            it('returns new access and refresh tokens', async () => {
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

    // 보호된 라우트
    describe('Access Token Protection', () => {
        let accessToken: string

        beforeEach(async () => {
            const { body } = await fix.httpClient
                .post('/customers/login')
                .body({ email, password })
                .ok()
            accessToken = body.accessToken
        })

        // 액세스 토큰이 유효한 경우
        describe('when the access token is valid', () => {
            // 접근을 허용한다
            it('allows access', async () => {
                await fix.httpClient
                    .get(`/customers/${customer.id}`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok()
            })
        })

        // 액세스 토큰이 유효하지 않은 경우
        describe('when the access token is invalid', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .get(`/customers/${customer.id}`)
                    .headers({ Authorization: 'Bearer Invalid-Token' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })
})
