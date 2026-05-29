import { createAdmin, Errors, loginAdmin, type AppTestContext } from '../helpers'

describe('AdminAuthentication', () => {
    let fix: AppTestContext
    const credentials = { email: 'admin@mail.com', password: 'password' }

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()

        await createAdmin(fix, credentials)
    })
    afterEach(() => fix.teardown())

    describe('POST /admins/login', () => {
        it('자격 증명이 유효하면 인증 토큰을 반환한다', async () => {
            await fix.httpClient
                .post('/admins/login')
                .body(credentials)
                .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
        })

        it('비밀번호가 틀리면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins/login')
                .body({ ...credentials, password: 'wrong password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('등록되지 않은 이메일이면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins/login')
                .body({ ...credentials, email: 'unknown@mail.com' })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('GET /admins/me', () => {
        it('유효한 액세스 토큰이면 admin DTO를 반환한다', async () => {
            const tokens = await loginAdmin(fix, credentials)

            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: `Bearer ${tokens.accessToken}` })
                .ok(
                    expect.objectContaining({
                        id: expect.any(String),
                        email: credentials.email,
                        name: expect.any(String)
                    })
                )
        })

        it('액세스 토큰이 없으면 500을 반환한다', async () => {
            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: 'Bearer invalid-token' })
                .internalServerError()
        })
    })

    describe('POST /admins/refresh', () => {
        it('유효한 리프레시 토큰이면 새 토큰을 반환한다', async () => {
            const { accessToken, refreshToken } = await loginAdmin(fix, credentials)

            const { body } = await fix.httpClient
                .post('/admins/refresh')
                .body({ refreshToken })
                .ok()

            expect(body.accessToken).not.toEqual(accessToken)
            expect(body.refreshToken).not.toEqual(refreshToken)
        })
    })

    describe('POST /admins/logout', () => {
        let refreshToken: string

        beforeEach(async () => {
            ;({ refreshToken } = await loginAdmin(fix, credentials))
        })

        it('로그아웃하면 204를 반환한다', async () => {
            await fix.httpClient.post('/admins/logout').body({ refreshToken }).noContent()
        })

        it('로그아웃한 refresh 토큰을 다시 쓰면 401을 던진다', async () => {
            await fix.httpClient.post('/admins/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/admins/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })
    })
})
