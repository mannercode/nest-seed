import { JwtService } from '@nestjs/jwt'
import { nullObjectId } from 'common'
import { AppConfigService } from 'config'
import { HttpTestClient } from 'testlib'
import {
    closeFixture,
    createFixture,
    Credentials,
    IsolatedFixture
} from './customers-auth.fixture'

describe('Customer Authentication', () => {
    let fixture: IsolatedFixture
    let client: HttpTestClient
    let credentials: Credentials
    let config: AppConfigService

    beforeEach(async () => {
        fixture = await createFixture()
        client = fixture.testContext.client
        config = fixture.config
        credentials = fixture.credentials
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    describe('POST /login', () => {
        it('로그인에 성공하면 인증 토큰을 반환해야 한다', async () => {
            await client.post('/customers/login').body(credentials).ok({
                accessToken: expect.anything(),
                refreshToken: expect.anything()
            })
        })

        it('비밀번호가 틀리면 UNAUTHORIZED(401)를 반환해야 한다', async () => {
            await client
                .post('/customers/login')
                .body({ email: credentials.email, password: 'wrong password' })
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
            const { body } = await client.post('/customers/login').body(credentials).ok()
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
                .unauthorized({ error: 'Unauthorized', message: 'jwt malformed', statusCode: 401 })
        })
    })

    describe('accessToken 검증', () => {
        let accessToken: string

        beforeEach(async () => {
            const { body } = await client.post('/customers/login').body(credentials).ok()
            accessToken = body.accessToken
        })

        it('유효한 accessToken을 제공하면 접근이 허용되어야 한다', async () => {
            await client
                .get(`/customers/${credentials.customerId}`)
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok()
        })

        it('잘못된 accessToken을 제공하면 UNAUTHORIZED(401)를 반환해야 한다', async () => {
            const invalidToken = 'SampleToken'

            await client
                .get(`/customers/${credentials.customerId}`)
                .headers({ Authorization: `Bearer ${invalidToken}` })
                .unauthorized({ message: 'Unauthorized', statusCode: 401 })
        })

        it('잘못된 데이터가 포함된 accessToken을 제공하면 UNAUTHORIZED(401)를 반환해야 한다', async () => {
            const jwtService = new JwtService()

            const wrongUserIdToken = jwtService.sign(
                { userId: nullObjectId },
                { secret: config.auth.accessSecret, expiresIn: '15m' }
            )

            await client
                .get(`/customers/${credentials.customerId}`)
                .headers({ Authorization: `Bearer ${wrongUserIdToken}` })
                .unauthorized({ message: 'Unauthorized', statusCode: 401 })
        })
    })
})
