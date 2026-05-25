import { createAdmin, Errors, loginAdmin, type AppTestContext } from '../helpers'

// root는 env 자격증명으로 인증되며 admin CRUD만 가진다.
// admin은 DB 도큐먼트로 존재하며 콘텐츠 CRUD만 가진다(권한이 서로 배타).
describe('Root + Admin CRUD', () => {
    let fix: AppTestContext
    const adminCredentials = { email: 'admin@mail.com', password: 'password' }
    const rootPassword = process.env.ROOT_PASSWORD
    if (!rootPassword) {
        throw new Error('ROOT_PASSWORD must be set for tests')
    }

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
    })
    afterEach(() => fix.teardown())

    async function loginRoot() {
        const { body } = await fix.httpClient
            .post('/admins/login')
            .body({ email: 'root', password: rootPassword })
            .ok()
        return body.accessToken as string
    }

    describe('POST /admins/login (root)', () => {
        it('환경변수 ROOT_PASSWORD와 일치하면 토큰을 발급한다', async () => {
            await fix.httpClient
                .post('/admins/login')
                .body({ email: 'root', password: rootPassword })
                .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
        })

        it('root password가 틀리면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins/login')
                .body({ email: 'root', password: 'wrong-root-password' })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })

    describe('POST /admins', () => {
        it('root 토큰이면 admin을 생성한다', async () => {
            const rootToken = await loginRoot()

            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: `Bearer ${rootToken}` })
                .body({ email: 'new-admin@mail.com', name: 'new', password: 'password' })
                .created(
                    expect.objectContaining({
                        id: expect.any(String),
                        email: 'new-admin@mail.com',
                        name: 'new'
                    })
                )
        })

        it('일반 admin 토큰이면 403을 반환한다', async () => {
            await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ email: 'second-admin@mail.com', name: 'second', password: 'password' })
                .forbidden(Errors.Auth.Forbidden())
        })

        it('이미 같은 이메일이 있으면 409를 반환한다', async () => {
            await createAdmin(fix, adminCredentials)
            const rootToken = await loginRoot()

            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: `Bearer ${rootToken}` })
                .body({ ...adminCredentials, name: 'dup' })
                .conflict()
        })

        it('중복 키 외의 오류는 그대로 전파한다', async () => {
            const { AdminsService } = await import('core')
            const service = fix.module.get(AdminsService)
            jest.spyOn(service, 'create').mockRejectedValueOnce(new Error('boom'))

            const rootToken = await loginRoot()

            await fix.httpClient
                .post('/admins')
                .headers({ Authorization: `Bearer ${rootToken}` })
                .body({ email: 'x@y.com', name: 'x', password: 'password' })
                .internalServerError()
        })
    })

    describe('DELETE /admins/:id', () => {
        it('root 토큰이면 admin을 삭제한다', async () => {
            const created = await createAdmin(fix, adminCredentials)
            const rootToken = await loginRoot()

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: `Bearer ${rootToken}` })
                .noContent()
        })

        it('일반 admin 토큰이면 403을 반환한다', async () => {
            const created = await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

            await fix.httpClient
                .delete(`/admins/${created.id}`)
                .headers({ Authorization: `Bearer ${accessToken}` })
                .forbidden(Errors.Auth.Forbidden())
        })
    })

    describe('GET /admins/me (root)', () => {
        it('root 토큰이면 404를 반환한다(도큐먼트 없음)', async () => {
            const rootToken = await loginRoot()

            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: `Bearer ${rootToken}` })
                .notFound()
        })
    })

    describe('콘텐츠 endpoint 권한 분리', () => {
        it('root 토큰으로 POST /movies는 403을 반환한다', async () => {
            const rootToken = await loginRoot()

            await fix.httpClient
                .post('/movies')
                .headers({ Authorization: `Bearer ${rootToken}` })
                .body({})
                .forbidden(Errors.Auth.Forbidden())
        })
    })
})
