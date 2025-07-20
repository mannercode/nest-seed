import { getModelToken } from '@nestjs/mongoose'
import { Customer, CustomerDto } from 'apps/cores'
import { MongooseConfigModule } from 'shared'
import { Errors } from '../__helpers__'
import { createCustomer } from '../common.fixture'
import { Fixture } from './customer-auth.fixture'

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
        // 올바른 자격 증명을 제공한 경우
        describe('when credentials are valid', () => {
            // 새로운 액세스 토큰과 리프레시 토큰을 반환한다
            it('returns new access and refresh tokens', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email, password })
                    .ok({
                        accessToken: expect.any(String),
                        refreshToken: expect.any(String)
                    })
            })
        })

        // 비밀번호가 틀린 경우
        describe('when the password is incorrect', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })

        // 이메일이 존재하지 않는 경우
        describe('when the email does not exist', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email: 'unknown@mail.com', password: '.' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })

        // 데이터베이스에 고객 정보가 없는 경우
        describe('when the customer is missing in the database', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                const model = fix.coresContext.module.get(
                    getModelToken(Customer.name, MongooseConfigModule.connectionName)
                )

                jest.spyOn(model, 'findById').mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(null)
                    })
                })

                await fix.httpClient
                    .post('/customers/login')
                    .body({ email, password })
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
            // 새로운 액세스 토큰과 리프레시 토큰을 반환한다
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

    // 액세스 토큰 보호 API를 테스트한다
    describe('access‑token–protected route', () => {
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
