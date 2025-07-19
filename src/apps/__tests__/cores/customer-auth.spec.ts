import { getModelToken } from '@nestjs/mongoose'
import { Customer, CustomerDto } from 'apps/cores'
import { MongooseConfigModule } from 'shared'
import { Errors } from '../__helpers__'
import { createCustomer } from '../common.fixture'
import { Fixture } from './customer-auth.fixture'

describe('CustomersService - Authentication', () => {
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
        // 유효한 자격증명으로 요청할 때
        describe('with valid credentials', () => {
            // 새로운 인증 토큰을 반환한다.
            it('returns a new set of authentication tokens', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email, password })
                    .ok({
                        accessToken: expect.any(String),
                        refreshToken: expect.any(String)
                    })
            })
        })

        // 비밀번호가 틀렸을 때
        describe('with an incorrect password', () => {
            // 401 에러를 반환한다.
            it('returns a 401 Unauthorized error', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })

        // 존재하지 않는 이메일일 때
        describe('with a non-existent email', () => {
            // 401 에러를 반환한다.
            it('returns a 401 Unauthorized error', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ email: 'unknown@mail.com', password: '.' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })

        // 인증은 성공했으나 DB에 고객 정보가 없을 때
        describe('when the authenticated customer is not found in the database', () => {
            // 401 에러를 반환한다.
            it('returns a 401 Unauthorized error', async () => {
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

        // 유효한 리프레시 토큰일 때
        describe('with a valid refresh token', () => {
            // 새로운 인증 토큰을 반환한다.
            it('returns a new set of authentication tokens', async () => {
                const { body } = await fix.httpClient
                    .post('/customers/refresh')
                    .body({ refreshToken })
                    .ok()

                expect(body.accessToken).not.toEqual(accessToken)
                expect(body.refreshToken).not.toEqual(refreshToken)
            })
        })

        // 유효하지 않은 리프레시 토큰일 때
        describe('with an invalid refresh token', () => {
            // 401 에러를 반환한다.
            it('returns a 401 Unauthorized error', async () => {
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

    // 액세스 토큰 검증
    describe('Access Token Verification', () => {
        let accessToken: string

        beforeEach(async () => {
            const { body } = await fix.httpClient
                .post('/customers/login')
                .body({ email, password })
                .ok()
            accessToken = body.accessToken
        })

        // 유효한 액세스 토큰일 때
        describe('with a valid access token', () => {
            // 접근을 허용한다.
            it('allows access to the protected route', async () => {
                await fix.httpClient
                    .get(`/customers/${customer.id}`)
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok()
            })
        })

        // 유효하지 않은 액세스 토큰일 때
        describe('with an invalid access token', () => {
            // 401 에러를 반환한다.
            it('returns a 401 Unauthorized error', async () => {
                await fix.httpClient
                    .get(`/customers/${customer.id}`)
                    .headers({ Authorization: 'Bearer Invalid-Token' })
                    .unauthorized(Errors.Auth.Unauthorized)
            })
        })
    })
})
