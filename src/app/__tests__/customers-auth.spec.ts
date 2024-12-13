import { CustomerDto } from 'services/cores'
import { HttpTestClient } from 'testlib'
import { closeFixture, createFixture, Fixture } from './customers-auth.fixture'

describe('/customers(authentication)', () => {
    let fixture: Fixture
    let client: HttpTestClient
    let customer: CustomerDto
    let email: string
    let password: string

    beforeEach(async () => {
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
                .unauthorized({ message: 'Unauthorized', statusCode: 401 })
        })

        it('이메일이 존재하지 않으면 UNAUTHORIZED(401)를 반환해야 한다', async () => {
            await client
                .post('/customers/login')
                .body({ email: 'unknown@mail.com', password: '.' })
                .unauthorized({ message: 'Unauthorized', statusCode: 401 })
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
                    code: 'ERR_REFRESH_TOKEN_VERIFICATION_FAILED',
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
                .unauthorized({ message: 'Unauthorized', statusCode: 401 })
        })
    })
})
