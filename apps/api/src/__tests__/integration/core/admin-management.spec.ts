import { createAdmin, Errors, loginAdmin, type AppTestContext } from '../helpers'

// root는 DB 도큐먼트 없이 env 자격증명(`ROOT_PASSWORD`)으로 Basic Auth 인증되고,
// admin lifecycle (생성/삭제)만 책임진다.
// admin은 DB 도큐먼트이고 자기 자신의 정보 조회·수정만 한다.
describe('Root + Admin lifecycle', () => {
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

    describe('POST /admins (root creates admin)', () => {
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
            const service = fix.module.get(AdminsService)

            // required 필드를 null로 보내 Mongoose ValidatorError를 유도한다.
            // class-validator는 컨트롤러에만 붙어 있으므로 service를 직접 호출한다.
            const invalidDto = { email: 'x@y.com', name: null as unknown as string, password: 'p' }

            await expect(service.create(invalidDto)).rejects.toThrow()
        })
    })

    describe('DELETE /admins/:id (root deletes admin)', () => {
        it('Basic Auth가 유효하면 admin을 삭제한다', async () => {
            const created = await createAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: rootBasic })
                .noContent()
        })

        it('Basic Auth가 없거나 잘못되면 401을 반환한다', async () => {
            const created = await createAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: wrongRootBasic })
                .unauthorized(Errors.Auth.Unauthorized())
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
            const wrongUser = `Basic ${Buffer.from('admin:DevPass1!').toString('base64')}`
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

    describe('PATCH /admins/me (admin updates self)', () => {
        it('admin 토큰으로 자기 이름을 수정한다', async () => {
            await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

            await fix.httpClient
                .patch('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ name: 'renamed' })
                .ok(expect.objectContaining({ email: adminCredentials.email, name: 'renamed' }))
        })

        it('자기 password를 바꾸면 새 password로 로그인된다', async () => {
            await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

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

        it('토큰이 없으면 401을 반환한다', async () => {
            await fix.httpClient.patch('/admins/me').body({ name: 'x' }).unauthorized()
        })

        it('email 변경도 반영된다', async () => {
            await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

            await fix.httpClient
                .patch('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ email: 'renamed@mail.com' })
                .ok(expect.objectContaining({ email: 'renamed@mail.com' }))
        })

        it('다른 admin과 같은 email로 바꾸려 하면 409를 반환한다', async () => {
            await createAdmin(fix, { email: 'a@mail.com', password: 'p' })
            await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

            await fix.httpClient
                .patch('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ email: 'a@mail.com' })
                .conflict()
        })

        it('자기 도큐먼트가 삭제되어 없으면 404를 반환한다', async () => {
            const created = await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: rootBasic })
                .noContent()

            await fix.httpClient
                .patch('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ name: 'x' })
                .notFound()
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
