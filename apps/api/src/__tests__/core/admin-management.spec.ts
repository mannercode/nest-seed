import type { AdminDto } from 'core'
import { createAdmin, Errors, loginAdmin, type AppTestContext } from '../helpers'

describe('AdminManagement', () => {
    let fix: AppTestContext
    const adminCredentials = { email: 'admin@mail.com', password: 'password' }
    const rootPassword = process.env.ROOT_PASSWORD
    if (!rootPassword) {
        throw new Error('ROOT_PASSWORD must be set for tests')
    }

    const rootBasic = `Basic ${Buffer.from(`root:${rootPassword}`).toString('base64')}`
    const wrongRootBasic = `Basic ${Buffer.from('root:wrong').toString('base64')}`

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
    })
    afterEach(() => fix.teardown())

    describe('POST /admins (root의 admin 생성)', () => {
        it('Basic Auth가 유효하면 admin을 생성한다', async () => {
            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: rootBasic })
                .body({ email: 'new-admin@mail.com', name: 'new', password: 'password' })
                .created(
                    expect.objectContaining({
                        id: expect.any(String),
                        email: 'new-admin@mail.com',
                        name: 'new'
                    })
                )
        })

        it('Basic Auth의 password가 틀리면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: wrongRootBasic })
                .body({ email: 'x@mail.com', name: 'x', password: 'password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('Authorization 헤더가 없으면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins')
                .body({ email: 'x@mail.com', name: 'x', password: 'password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('이미 같은 이메일이 있으면 409를 반환한다', async () => {
            await createAdmin(fix, adminCredentials)

            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: rootBasic })
                .body({ ...adminCredentials, name: 'dup' })
                .conflict()
        })

        it('중복 키 외의 저장 오류는 ConflictException으로 바꾸지 않고 그대로 던진다', async () => {
            const { AdminsService } = await import('core')
            const { ConflictException } = await import('@nestjs/common')
            const service = fix.module.get(AdminsService)

            // required 필드를 null로 보내 Mongoose ValidatorError를 유도한다.
            // class-validator는 컨트롤러에만 붙어 있으므로 service를 직접 호출한다.
            const invalidDto = { email: 'x@y.com', name: null as unknown as string, password: 'p' }

            // "그대로 던진다"의 핵심은 409로 변환되지 않는 것이므로 예외 타입까지 확인한다.
            const promise = service.create(invalidDto)
            await expect(promise).rejects.toThrow()
            await expect(promise).rejects.not.toBeInstanceOf(ConflictException)
        })
    })

    describe('DELETE /admins/:id (root의 admin 삭제)', () => {
        it('Basic Auth가 유효하면 204를 반환한다', async () => {
            const created = await createAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: rootBasic })
                .noContent()
        })

        it('Basic Auth가 잘못되면 401을 반환한다', async () => {
            const created = await createAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: wrongRootBasic })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('제거된 admin의 이메일로 다시 admin을 만들 수 있다', async () => {
            const created = await createAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: rootBasic })
                .noContent()

            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: rootBasic })
                .body({ ...adminCredentials, name: 'again' })
                .created(expect.objectContaining({ email: adminCredentials.email }))
        })

        it('제거된 admin의 리프레시 토큰은 더 이상 갱신되지 않는다', async () => {
            const created = await createAdmin(fix, adminCredentials)
            const { refreshToken } = await loginAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: rootBasic })
                .noContent()

            await fix.httpClient
                .post('/admins/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })
    })

    describe('RootAuthGuard 형식 검증', () => {
        it('Basic 외 다른 스킴이면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: 'Bearer something' })
                .body({ email: 'x@mail.com', name: 'x', password: 'password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it("username이 'root'가 아니면 401을 반환한다", async () => {
            // 비밀번호는 실제 값을 써서 "username만 틀린" 경우를 검증한다. 하드코딩하면 env 변경 시 의도가 무너진다.
            const wrongUser = `Basic ${Buffer.from(`admin:${rootPassword}`).toString('base64')}`
            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: wrongUser })
                .body({ email: 'x@mail.com', name: 'x', password: 'password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('자격증명 콜론이 없어도 401을 반환한다', async () => {
            const noColon = `Basic ${Buffer.from('rootonly').toString('base64')}`
            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: noColon })
                .body({ email: 'x@mail.com', name: 'x', password: 'password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('PATCH /admins/me (admin 본인 수정)', () => {
        describe('로그인했을 때', () => {
            let admin: AdminDto
            let accessToken: string
            let refreshToken: string

            beforeEach(async () => {
                await createAdmin(fix, adminCredentials)
                ;({ accessToken, admin, refreshToken } = await loginAdmin(fix, adminCredentials))
            })

            it('이름을 수정하면 수정된 admin을 반환한다', async () => {
                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ name: 'renamed' })
                    .ok({ ...admin, name: 'renamed' })
            })

            it('수정 내용이 DB에 저장된다', async () => {
                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ name: 'renamed' })
                    .ok()

                await fix.httpClient
                    .get('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ ...admin, name: 'renamed' })
            })

            it('자기 password를 바꾸면 새 password로 로그인할 수 있다', async () => {
                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ password: 'newPassword' })
                    .ok()

                await fix.httpClient
                    .post('/admins/login')
                    .body({ email: adminCredentials.email, password: 'newPassword' })
                    .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
            })

            it('password를 바꾸면 기존 리프레시 토큰은 더 이상 갱신되지 않는다', async () => {
                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ password: 'newPassword' })
                    .ok()

                await fix.httpClient
                    .post('/admins/refresh')
                    .body({ refreshToken })
                    .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
            })

            it('email을 변경하면 변경된 email을 반환한다', async () => {
                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ email: 'renamed@mail.com' })
                    .ok({ ...admin, email: 'renamed@mail.com' })
            })

            it('다른 admin과 같은 email로 바꾸려 하면 409를 반환한다', async () => {
                await createAdmin(fix, { email: 'a@mail.com', password: 'p' })

                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ email: 'a@mail.com' })
                    .conflict()
            })

            it('자기 도큐먼트가 삭제되어 없으면 404를 반환한다', async () => {
                await fix.httpClient
                    .delete(`/admins/${admin.id}`)
                    .headers({ Authorization: rootBasic })
                    .noContent()

                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ name: 'x' })
                    .notFound()
            })
        })

        it('토큰이 없으면 401을 반환한다', async () => {
            await fix.httpClient.patch('/admins/me').body({ name: 'x' }).unauthorized()
        })

        it('중복 키 외의 저장 오류는 ConflictException으로 바꾸지 않고 그대로 던진다', async () => {
            const created = await createAdmin(fix, adminCredentials)

            const { AdminsRepository, AdminsService } = await import('core')
            const service = fix.module.get(AdminsService)
            const repo = fix.module.get(AdminsRepository)
            jest.spyOn(repo, 'update').mockRejectedValueOnce(new Error('boom'))

            await expect(service.update(created.id, { name: 'x' })).rejects.toThrow('boom')
        })
    })

    describe('GET /admins/me', () => {
        it('자기 도큐먼트가 삭제되어 없으면 404를 반환한다', async () => {
            const created = await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: rootBasic })
                .noContent()

            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .notFound()
        })
    })
})
