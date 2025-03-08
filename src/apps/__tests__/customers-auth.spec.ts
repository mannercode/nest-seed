import { getModelToken } from '@nestjs/mongoose'
import { Customer, CustomerDto } from 'cores'
import { MongooseConfig } from 'shared/config'
import { HttpTestClient } from 'testlib'
import { closeFixture, Fixture } from './customers-auth.fixture'
import { Errors } from './utils'

describe('/customers(authentication)', () => {
    let fixture: Fixture
    let client: HttpTestClient
    let customer: CustomerDto
    let email: string
    let password: string

    beforeEach(async () => {
        const { createFixture } = await import('./customers-auth.fixture')

        fixture = await createFixture()
        client = fixture.testContext.client
        customer = fixture.customer
        email = customer.email
        password = fixture.password
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    describe('POST /login', () => {
        it('로그인에 성공하면 인증 토큰을 반환해야 한다', async () => {
            await client
                .post('/customers/login')
                .body({ email, password })
                .ok({
                    accessToken: expect.any(String),
                    refreshToken: expect.any(String)
                })
        })

        it('비밀번호가 틀리면 UNAUTHORIZED(401)를 반환해야 한다', async () => {
            await client
                .post('/customers/login')
                .body({ email, password: 'wrong password' })
                .unauthorized(Errors.Auth.Unauthorized)
        })

        it('이메일이 존재하지 않으면 UNAUTHORIZED(401)를 반환해야 한다', async () => {
            await client
                .post('/customers/login')
                .body({ email: 'unknown@mail.com', password: '.' })
                .unauthorized(Errors.Auth.Unauthorized)
        })

        it('customer가 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            const model = fixture.testContext.coresContext.module.get(
                getModelToken(Customer.name, MongooseConfig.connName)
            )
            jest.spyOn(model, 'findById').mockImplementation(() => ({
                select: jest.fn().mockImplementation(() => ({
                    exec: jest.fn()
                }))
            }))

            await client
                .post('/customers/login')
                .body({ email, password })
                .notFound({
                    ...Errors.Customer.NotFound,
                    customerId: customer.id
                })
        })
    })

    describe('POST /refresh', () => {
        let accessToken: string
        let refreshToken: string

        beforeEach(async () => {
            const { body } = await client.post('/customers/login').body({ email, password }).ok()
            accessToken = body.accessToken
            refreshToken = body.refreshToken
        })

        it('유효한 refreshToken을 제공하면 새로운 인증 토큰을 반환해야 한다', async () => {
            const { body } = await client.post('/customers/refresh').body({ refreshToken }).ok()

            expect(body.accessToken).not.toEqual(accessToken)
            expect(body.refreshToken).not.toEqual(refreshToken)
        })

        it('잘못된 refreshToken을 제공하면 UNAUTHORIZED(401)를 반환해야 한다', async () => {
            await client
                .post('/customers/refresh')
                .body({ refreshToken: 'invalid-token' })
                .unauthorized({
                    ...Errors.Auth.RefreshTokenVerificationFailed,
                    message: 'jwt malformed'
                })
        })
    })

    describe('accessToken 검증', () => {
        let accessToken: string

        beforeEach(async () => {
            const { body } = await client.post('/customers/login').body({ email, password }).ok()
            accessToken = body.accessToken
        })

        it('유효한 accessToken을 제공하면 접근이 허용되어야 한다', async () => {
            await client
                .get(`/customers/${customer.id}`)
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok()
        })

        it('잘못된 accessToken을 제공하면 UNAUTHORIZED(401)를 반환해야 한다', async () => {
            const invalidToken = 'SampleToken'

            await client
                .get(`/customers/${customer.id}`)
                .headers({ Authorization: `Bearer ${invalidToken}` })
                .unauthorized(Errors.Auth.Unauthorized)
        })
    })
})
