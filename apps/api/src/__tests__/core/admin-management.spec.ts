import { nullObjectId } from '@mannercode/testing'
import { type AdminDto, AdminsService, AdminsRepository } from '#core'
import {
    createAdmin,
    Errors,
    loginAdmin,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { ConflictException } from '@nestjs/common'

describe('AdminManagement', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    const adminCredentials = { email: 'admin@mail.com', password: 'password' }

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
    })
    afterEach(() => teardown?.())

    describe('admin lifecycle을 HTTP로 요청하면', () => {
        it('POST /admins는 404를 반환한다', async () => {
            await fix.httpClient
                .post('/admins')
                .body({ email: 'new-admin@mail.com', name: 'new', password: 'password' })
                .notFound()
        })

        it('DELETE /admins/:id는 404를 반환한다', async () => {
            await fix.httpClient.delete(`/admins/${nullObjectId}`).notFound()
        })
    })

    describe('AdminsService.create', () => {
        it('admin을 생성한다', async () => {
            await expect(createAdmin(fix, adminCredentials)).resolves.toEqual(
                expect.objectContaining({
                    id: expect.any(String),
                    email: adminCredentials.email,
                    name: 'admin'
                })
            )
        })

        describe('email이 이미 존재하면', () => {
            beforeEach(async () => {
                await createAdmin(fix, adminCredentials)
            })

            it('409 Conflict를 던진다', async () => {
                await expect(createAdmin(fix, adminCredentials)).rejects.toMatchObject({
                    status: 409
                })
            })
        })

        it('중복 키 외의 저장 오류는 ConflictException으로 바꾸지 않고 그대로 던진다', async () => {
            const service = fix.module.get(AdminsService)

            // required 필드를 null로 보내 저장 경계 검증 오류를 유도한다.
            // 요청 스키마 검증은 컨트롤러에만 적용되므로 service를 직접 호출한다.
            const invalidDto = { email: 'x@y.com', name: null as unknown as string, password: 'p' }

            // "그대로 던진다"의 핵심은 409로 변환되지 않는 것이므로 예외 타입까지 확인한다.
            const promise = service.create(invalidDto)
            await expect(promise).rejects.toThrow()
            await expect(promise).rejects.not.toBeInstanceOf(ConflictException)
        })
    })

    describe('AdminsService.remove', () => {
        it('존재하지 않는 admin이면 404를 반환한다', async () => {
            const service = fix.module.get(AdminsService)

            await expect(service.remove(nullObjectId)).rejects.toThrow(
                Errors.Mongo.DocumentNotFound(nullObjectId).message
            )
        })

        it('제거된 admin의 이메일로 다시 admin을 만들 수 있다', async () => {
            const created = await createAdmin(fix, adminCredentials)

            const service = fix.module.get(AdminsService)

            await service.remove(created.id)

            await expect(createAdmin(fix, adminCredentials)).resolves.toEqual(
                expect.objectContaining({ email: adminCredentials.email })
            )
        })

        it('제거된 admin의 리프레시 토큰은 더 이상 갱신되지 않는다', async () => {
            const created = await createAdmin(fix, adminCredentials)
            const { refreshToken } = await loginAdmin(fix, adminCredentials)

            const service = fix.module.get(AdminsService)

            await service.remove(created.id)

            await fix.httpClient
                .post('/admins/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
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

            describe('password를 변경하면', () => {
                const newPassword = 'newPassword'

                beforeEach(async () => {
                    await fix.httpClient
                        .patch('/admins/me')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body({ password: newPassword })
                        .ok()
                })

                it('새 password로 로그인할 수 있다', async () => {
                    await fix.httpClient
                        .post('/admins/login')
                        .body({ email: adminCredentials.email, password: newPassword })
                        .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
                })

                it('기존 리프레시 토큰은 더 이상 갱신되지 않는다', async () => {
                    await fix.httpClient
                        .post('/admins/refresh')
                        .body({ refreshToken })
                        .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
                })

                it('기존 액세스 토큰을 즉시 거부한다', async () => {
                    await fix.httpClient
                        .get('/admins/me')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .unauthorized(Errors.Auth.Unauthorized())
                })
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

            it('자기 도큐먼트가 삭제되면 기존 액세스 토큰으로 쓰기도 401을 반환한다', async () => {
                await fix.module.get(AdminsService).remove(admin.id)

                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ name: 'x' })
                    .unauthorized(Errors.Auth.Unauthorized())
            })
        })

        it('토큰이 없으면 401을 반환한다', async () => {
            await fix.httpClient.patch('/admins/me').body({ name: 'x' }).unauthorized()
        })

        it('중복 키 외의 저장 오류는 ConflictException으로 바꾸지 않고 그대로 던진다', async () => {
            const created = await createAdmin(fix, adminCredentials)

            const service = fix.module.get(AdminsService)
            const repo = fix.module.get(AdminsRepository)
            vi.spyOn(repo, 'update').mockRejectedValueOnce(new Error('boom'))

            await expect(service.update(created.id, { name: 'x' })).rejects.toThrow('boom')
        })

        it('존재하지 않는 admin을 수정하면 404를 던진다', async () => {
            const service = fix.module.get(AdminsService)

            await expect(service.update(nullObjectId, { name: 'x' })).rejects.toThrow(
                Errors.Mongo.DocumentNotFound(nullObjectId).message
            )
        })
    })

    describe('GET /admins/me', () => {
        it('자기 도큐먼트가 삭제되면 기존 액세스 토큰을 401로 거부한다', async () => {
            const created = await createAdmin(fix, adminCredentials)
            const { accessToken } = await loginAdmin(fix, adminCredentials)

            await fix.module.get(AdminsService).remove(created.id)

            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .unauthorized(Errors.Auth.Unauthorized())
        })
    })
})
