import { createCustomer, Errors } from 'apps/__tests__/__helpers__'
import type { CustomerAuthFixture } from './customer-auth.fixture'

describe('CustomerAuthentication', () => {
    let fix: CustomerAuthFixture
    const credentials = { email: 'user@mail.com', password: 'password' }

    beforeEach(async () => {
        const { createCustomerAuthFixture } = await import('./customer-auth.fixture')
        fix = await createCustomerAuthFixture()

        await createCustomer(fix, credentials)
    })
    afterEach(() => fix.teardown())

    describe('POST /customers/login', () => {
        // 자격 증명이 유효할 때
        describe('when the credentials are valid', () => {
            // 인증 토큰을 반환한다
            it('returns auth tokens', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body(credentials)
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })
        })

        // 비밀번호가 올바르지 않을 때
        describe('when the password is incorrect', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...credentials, password: 'wrong password' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })

        // 이메일이 등록되지 않았을 때
        describe('when the email is not registered', () => {
            // 401 Unauthorized를 반환한다
            it('returns 401 Unauthorized', async () => {
                await fix.httpClient
                    .post('/customers/login')
                    .body({ ...credentials, email: 'unknown@mail.com' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })
    })
})
