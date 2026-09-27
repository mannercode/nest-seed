import { HttpStatus, type INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { TimeUtil } from '@mannercode/common'
import { AppConfigService } from '#config'
import type { AdminDto } from '#core'
import {
    createAdmin,
    Errors,
    loginAdmin,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'

const IP_FAILURE_LIMIT = 50
const LOGIN_RATE_LIMITED_ERROR = {
    code: 'ERR_AUTH_LOGIN_RATE_LIMITED',
    message: 'Too many login attempts'
}

function trustPrivateProxy(app: INestApplication) {
    app.getHttpAdapter().getInstance().set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
}

describe('AdminAuthentication', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    const credentials = { email: 'admin@mail.com', password: 'password' }

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext({ configureApp: async (app) => trustPrivateProxy(app) })
        teardown = fix.teardown

        await createAdmin(fix, credentials)
    })
    afterEach(() => teardown?.())

    describe('POST /admins/login', () => {
        describe('이메일과 비밀번호가 등록된 관리자 정보와 일치하면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post('/admins/login').body(credentials)
            })
            it('로그인하면 인증 토큰을 반환한다', async () => {
                const { body } = await request.ok({
                    expected: { accessToken: expect.any(String), refreshToken: expect.any(String) }
                })

                const { exp, iat } = new JwtService().decode<{ exp: number; iat: number }>(
                    body.accessToken
                )
                const { adminAuth } = fix.module.get(AppConfigService)
                expect(exp - iat).toBe(TimeUtil.toMs(adminAuth.accessTokenExpiration) / 1000)
            })
        })

        describe('비밀번호가 틀리면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/admins/login')
                    .body({ ...credentials, password: 'wrong password' })
            })
            it('로그인을 요청하면 401을 반환한다', async () => {
                await request.unauthorized({ expected: Errors.Auth.Unauthorized() })
            })
        })

        describe('등록되지 않은 이메일이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/admins/login')
                    .body({ ...credentials, email: 'unknown@mail.com' })
            })
            it('로그인을 요청하면 401을 반환한다', async () => {
                await request.unauthorized({ expected: Errors.Auth.Unauthorized() })
            })
        })

        describe('여러 IP에서 같은 계정으로 로그인에 실패한 기록이 있으면', () => {
            beforeEach(async () => {
                for (let index = 0; index < 6; index++) {
                    await fix.httpClient
                        .post('/admins/login')
                        .headers({ 'X-Forwarded-For': `198.51.100.${index + 1}` })
                        .body({ ...credentials, password: 'wrong password' })
                        .unauthorized({ expected: Errors.Auth.Unauthorized() })
                }
            })
            it('다른 IP에서 올바른 비밀번호로 로그인할 수 있다', async () => {
                await fix.httpClient
                    .post('/admins/login')
                    .headers({ 'X-Forwarded-For': '198.51.100.7' })
                    .body(credentials)
                    .ok()
            })
        })

        describe('같은 IP에서 49회 로그인 실패 후 한 번 성공했으면', () => {
            let ip: string
            beforeEach(async () => {
                ip = '198.51.100.100'

                for (let index = 0; index < IP_FAILURE_LIMIT - 1; index++) {
                    await fix.httpClient
                        .post('/admins/login')
                        .headers({ 'X-Forwarded-For': ip })
                        .body({ email: `unknown-${index}@mail.com`, password: 'wrong password' })
                        .unauthorized({ expected: Errors.Auth.Unauthorized() })
                }

                await fix.httpClient
                    .post('/admins/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body(credentials)
                    .ok()
            })
            it('같은 IP에서 잘못된 정보로 로그인을 두 번 요청하면 차례로 401과 429를 반환한다', async () => {
                await fix.httpClient
                    .post('/admins/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body({ email: 'unknown-50@mail.com', password: 'wrong password' })
                    .unauthorized({ expected: Errors.Auth.Unauthorized() })

                await fix.httpClient
                    .post('/admins/login')
                    .headers({ 'X-Forwarded-For': ip })
                    .body({ email: 'unknown-51@mail.com', password: 'wrong password' })
                    .send(HttpStatus.TOO_MANY_REQUESTS, { expected: LOGIN_RATE_LIMITED_ERROR })
            })
        })
    })

    describe('GET /admins/me', () => {
        describe('관리자로 로그인했으면', () => {
            let tokens: Awaited<ReturnType<typeof loginAdmin>>
            beforeEach(async () => {
                tokens = await loginAdmin(fix, credentials)
            })
            it('본인 정보를 조회하면 로그인한 관리자 정보를 반환한다', async () => {
                await fix.httpClient
                    .get('/admins/me')
                    .headers({ Authorization: `Bearer ${tokens.accessToken}` })
                    .ok({
                        expected: expect.objectContaining({
                            id: expect.any(String),
                            email: credentials.email,
                            name: expect.any(String)
                        })
                    })
            })
        })

        describe('액세스 토큰이 유효하지 않으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/admins/me')
                    .headers({ Authorization: 'Bearer invalid-token' })
            })
            it('본인 정보를 조회하면 401을 반환한다', async () => {
                await request.unauthorized({ expected: Errors.Auth.Unauthorized() })
            })
        })

        describe.each([
            { condition: '사용자 ID가 빠진 토큰이 있으면', payload: { email: 'admin@mail.com' } },
            {
                condition: '이메일 형식이 잘못된 토큰이 있으면',
                payload: { email: 'invalid', sub: 'admin-id' }
            }
        ])('올바르게 서명했지만 $condition', ({ payload }) => {
            let token: string

            beforeEach(async () => {
                const { adminAuth } = fix.module.get(AppConfigService)
                token = await new JwtService().signAsync(payload, {
                    audience: adminAuth.audience,
                    issuer: adminAuth.issuer,
                    secret: adminAuth.accessSecret,
                    expiresIn: '5m'
                })
            })

            it('본인 조회 요청에 401을 반환한다', async () => {
                await fix.httpClient
                    .get('/admins/me')
                    .headers({ Authorization: `Bearer ${token}` })
                    .unauthorized({ expected: Errors.Auth.Unauthorized() })
            })
        })
    })

    describe('POST /admins/refresh', () => {
        describe('유효한 리프레시 토큰을 가지고 있을 때', () => {
            let tokens: Awaited<ReturnType<typeof loginAdmin>>

            beforeEach(async () => {
                tokens = await loginAdmin(fix, credentials)
            })

            it('토큰 갱신을 요청하면 새 액세스 토큰과 리프레시 토큰을 반환한다', async () => {
                const { body } = await fix.httpClient
                    .post('/admins/refresh')
                    .body({ refreshToken: tokens.refreshToken })
                    .ok({
                        expected: {
                            accessToken: expect.stringMatching(/\S/),
                            refreshToken: expect.stringMatching(/\S/)
                        }
                    })

                expect(body.accessToken).not.toEqual(tokens.accessToken)
                expect(body.refreshToken).not.toEqual(tokens.refreshToken)
            })
        })
    })

    describe('POST /admins/logout', () => {
        let accessToken: string
        let refreshToken: string
        let admin: AdminDto

        beforeEach(async () => {
            ;({ accessToken, refreshToken, admin } = await loginAdmin(fix, credentials))
        })

        it('로그아웃하면 204를 반환한다', async () => {
            await fix.httpClient.post('/admins/logout').body({ refreshToken }).noContent()
        })

        it('로그아웃하면 리프레시 갱신은 거절하고 기존 액세스 토큰으로 본인 조회는 허용한다', async () => {
            await fix.httpClient.post('/admins/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/admins/refresh')
                .body({ refreshToken })
                .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })

            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok({ expected: admin })
        })
    })
})
