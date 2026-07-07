import type { UserDto } from 'core'
import { oid } from '@mannercode/testing'
import {
    createPurchaseRecord,
    createUser,
    Errors,
    loginUser,
    type AppTestContext
} from '../helpers'

describe('UserAuthentication', () => {
    let fix: AppTestContext
    const credentials = { email: 'user@mail.com', password: 'password' }

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()

        await createUser(fix, credentials)
    })
    afterEach(() => fix.teardown())

    describe('POST /users/login', () => {
        it('자격 증명이 유효하면 인증 토큰을 반환한다', async () => {
            await fix.httpClient
                .post('/users/login')
                .body(credentials)
                .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
        })

        it('비밀번호가 틀리면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/login')
                .body({ ...credentials, password: 'wrong password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('등록되지 않은 이메일이면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/login')
                .body({ ...credentials, email: 'unknown@mail.com' })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('GET /users/me', () => {
        it('유효한 액세스 토큰이면 현재 고객의 도메인 DTO를 반환한다', async () => {
            const authTokens = await loginUser(fix, credentials)

            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${authTokens.accessToken}` })
                .ok(
                    expect.objectContaining({
                        id: expect.any(String),
                        email: credentials.email,
                        name: expect.any(String)
                    })
                )
        })

        it('액세스 토큰이 검증되지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('리프레시 토큰을 액세스 토큰 자리에 쓰면 401을 반환한다', async () => {
            // 두 토큰은 iss/aud가 같아 secret 분리만이 방벽이다 — 이 검증이 무너지면
            // 수명이 긴 리프레시 토큰이 로그아웃으로도 회수되지 않는 액세스 토큰으로 동작한다.
            const { refreshToken } = await loginUser(fix, credentials)

            await fix.httpClient
                .get('/users/me')
                .headers({ Authorization: `Bearer ${refreshToken}` })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('DELETE /users/me', () => {
        describe('로그인했을 때', () => {
            let accessToken: string
            let user: UserDto

            beforeEach(async () => {
                ;({ accessToken, user } = await loginUser(fix, credentials))
            })

            it('204를 반환한다', async () => {
                await fix.httpClient
                    .delete('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .noContent()
            })

            it('삭제 후 같은 토큰으로 조회하면 404를 반환한다', async () => {
                await fix.httpClient
                    .delete('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .noContent()

                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([user.id]))
            })
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.delete('/users/me').unauthorized()
        })
    })

    describe('PATCH /users/me', () => {
        describe('로그인했을 때', () => {
            let accessToken: string
            let user: UserDto
            const updateDto = { name: 'updated-name' }

            beforeEach(async () => {
                ;({ accessToken, user } = await loginUser(fix, credentials))
            })

            it('수정된 DTO를 반환한다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(updateDto)
                    .ok({ ...user, ...updateDto })
            })

            it('수정 내용이 DB에 저장된다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(updateDto)
                    .ok()

                await fix.httpClient
                    .get('/users/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ ...user, ...updateDto })
            })
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.patch('/users/me').body({ name: 'x' }).unauthorized()
        })
    })

    describe('GET /users/me/purchases', () => {
        it('본인 구매 기록만 반환한다', async () => {
            const { accessToken, user } = await loginUser(fix, credentials)

            // 본인 기록 둘과 타인 기록 하나를 심어, 토큰 주체의 것만 조회되는지 본다.
            const mine1 = await createPurchaseRecord(fix, { userId: user.id })
            const mine2 = await createPurchaseRecord(fix, { userId: user.id })
            await createPurchaseRecord(fix, { userId: oid(0xff) })

            const { body } = await fix.httpClient
                .get('/users/me/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok()

            expect(body).toEqual(expect.arrayContaining([mine1, mine2]))
            expect(body).toHaveLength(2)
            expect(body.every((record: { userId: string }) => record.userId === user.id)).toBe(true)
        })

        it('구매 기록이 없으면 빈 배열을 반환한다', async () => {
            const { accessToken } = await loginUser(fix, credentials)

            await fix.httpClient
                .get('/users/me/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .ok([])
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.get('/users/me/purchases').unauthorized()
        })
    })

    describe('POST /users/refresh', () => {
        it('유효한 리프레시 토큰이면 새 인증 토큰을 반환한다', async () => {
            const { accessToken, refreshToken } = await loginUser(fix, credentials)

            const { body } = await fix.httpClient.post('/users/refresh').body({ refreshToken }).ok()

            expect(body.accessToken).not.toEqual(accessToken)
            expect(body.refreshToken).not.toEqual(refreshToken)
        })

        it('리프레시 토큰이 검증되지 않으면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: 'invalid-token' })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })
    })

    describe('POST /users/logout', () => {
        let refreshToken: string

        beforeEach(async () => {
            ;({ refreshToken } = await loginUser(fix, credentials))
        })

        it('로그아웃하면 204를 반환한다', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()
        })

        it('로그아웃 후에는 같은 토큰의 리프레시를 차단한다', async () => {
            await fix.httpClient.post('/users/logout').body({ refreshToken }).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })

        it('잘못된 토큰으로 로그아웃하면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/users/logout')
                .body({ refreshToken: 'garbage' })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })
    })

    describe('POST /users/me/logout-all', () => {
        it('전체 로그아웃 시 모든 디바이스의 리프레시가 차단된다', async () => {
            const sessionA = await loginUser(fix, credentials)
            const sessionB = await loginUser(fix, credentials)

            await fix.httpClient
                .post('/users/me/logout-all')
                .headers({ Authorization: `Bearer ${sessionA.accessToken}` })
                .noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: sessionA.refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: sessionB.refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })

        it('인증 없이 호출하면 401을 반환한다', async () => {
            await fix.httpClient.post('/users/me/logout-all').unauthorized()
        })
    })
})
