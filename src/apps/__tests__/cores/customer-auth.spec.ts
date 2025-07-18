import { getModelToken } from '@nestjs/mongoose'
import { Customer, CustomerDto } from 'apps/cores'
import { MongooseConfigModule } from 'shared'
import { Errors } from '../__helpers__'
import { createCustomer } from '../common.fixture'
import { Fixture } from './customer-auth.fixture'

describe('Customer Authentication', () => {
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

    describe('POST /login', () => {
        // 로그인에 성공하면 인증 토큰을 반환해야 한다
        it('Should return an authentication token upon successful login', async () => {
            await fix.httpClient
                .post('/customers/login')
                .body({ email, password })
                .ok({
                    accessToken: expect.any(String),
                    refreshToken: expect.any(String)
                })
        })

        // 비밀번호가 틀리면 UNAUTHORIZED(401)를 반환해야 한다
        it('Should return UNAUTHORIZED(401) if the password is incorrect', async () => {
            await fix.httpClient
                .post('/customers/login')
                .body({ email, password: 'wrong password' })
                .unauthorized(Errors.Auth.Unauthorized)
        })

        // 이메일이 존재하지 않으면 UNAUTHORIZED(401)를 반환해야 한다
        it('Should return UNAUTHORIZED(401) if the email does not exist', async () => {
            await fix.httpClient
                .post('/customers/login')
                .body({ email: 'unknown@mail.com', password: '.' })
                .unauthorized(Errors.Auth.Unauthorized)
        })

        // customer가 존재하지 않으면 UNAUTHORIZED(401)를 반환해야 한다
        it('Should return UNAUTHORIZED(401) if the customer does not exist', async () => {
            /**
             * Mocking the following code in CustomersRepository. This test is for code coverage.
             * CustomersRepository의 아래 코드를 모의하는 것이다. 코드 커버리지를 위해 작성한 테스트다.
             *
             * this.model.findById(customerId).select('+password').exec()
             */
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

    describe('POST /refresh', () => {
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

        // 유효한 refreshToken을 제공하면 새로운 인증 토큰을 반환해야 한다
        it('Should return a new authentication token if a valid refreshToken is provided', async () => {
            const { body } = await fix.httpClient
                .post('/customers/refresh')
                .body({ refreshToken })
                .ok()

            expect(body.accessToken).not.toEqual(accessToken)
            expect(body.refreshToken).not.toEqual(refreshToken)
        })

        // 잘못된 refreshToken을 제공하면 UNAUTHORIZED(401)를 반환해야 한다
        it('Should return UNAUTHORIZED(401) if an invalid refreshToken is provided', async () => {
            await fix.httpClient
                .post('/customers/refresh')
                .body({ refreshToken: 'invalid-token' })
                .unauthorized({
                    ...Errors.JwtAuth.RefreshTokenVerificationFailed,
                    message: 'jwt malformed'
                })
        })
    })

    describe('accessToken 검증', () => {
        let accessToken: string

        beforeEach(async () => {
            const { body } = await fix.httpClient
                .post('/customers/login')
                .body({ email, password })
                .ok()

            accessToken = body.accessToken
        })

        // 유효한 accessToken이면 접근을 허용해야 한다
        it('Should allow access if the accessToken is valid', async () => {
            await fix.httpClient
                .get(`/customers/${customer.id}`)
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok()
        })

        // 잘못된 accessToken이면 UNAUTHORIZED(401)를 반환해야 한다
        it('Should return UNAUTHORIZED(401) if the accessToken is invalid', async () => {
            await fix.httpClient
                .get(`/customers/${customer.id}`)
                .headers({ Authorization: 'Bearer Invalid-Token' })
                .unauthorized(Errors.Auth.Unauthorized)
        })
    })
})
