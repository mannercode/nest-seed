import { nullObjectId } from '@mannercode/testing'
import { type AdminDto, AdminsService, AdminsRepository } from '#core'
import {
    createAdmin,
    Errors,
    loginAdmin,
    runAdminCreateScript,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { ConflictException } from '@nestjs/common'

describe('AdminManagement', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    const adminCredentials = { email: 'admin@mail.com', password: 'Example password 1!' }

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
    })
    afterEach(() => teardown?.())

    describe('관리자 생성·삭제 HTTP 경로', () => {
        it('POST /admins로 관리자 생성을 요청하면 404를 반환한다', async () => {
            await fix.httpClient
                .post('/admins')
                .body({ email: 'new-admin@mail.com', name: 'new', password: 'Example password 1!' })
                .notFound()
        })

        it('DELETE /admins/:id로 관리자 삭제를 요청하면 404를 반환한다', async () => {
            await fix.httpClient.delete(`/admins/${nullObjectId}`).notFound()
        })
    })

    describe('AdminsService.create', () => {
        describe.each([
            { condition: 'ASCII 14자', password: 'a'.repeat(14) },
            { condition: '이모지 14자', password: '🌱'.repeat(14) },
            { condition: '한글 129자', password: '가'.repeat(129) }
        ])('비밀번호에 $condition 값을 입력하면', ({ password }) => {
            let createDto: Parameters<AdminsService['create']>[0]
            beforeEach(() => {
                createDto = { ...adminCredentials, name: 'admin', password }
            })
            it('관리자 생성을 요청하면 검증 오류를 던지고 저장하지 않는다', async () => {
                await expect(fix.module.get(AdminsService).create(createDto)).rejects.toMatchObject(
                    { name: 'ZodError' }
                )
                expect(
                    await fix.module
                        .get(AdminsRepository)
                        .findForAuthentication({ email: adminCredentials.email })
                ).toBeNull()
            })
        })

        describe.each([
            { condition: 'ASCII 15자', password: 'a'.repeat(15) },
            { condition: '이모지 15자', password: '🌱'.repeat(15) },
            { condition: '이모지 128자', password: '🌱'.repeat(128) },
            { condition: '공백 15자', password: ' '.repeat(15) }
        ])('비밀번호에 $condition 값을 입력하면', ({ password }) => {
            let createDto: Parameters<AdminsService['create']>[0]
            beforeEach(() => {
                createDto = { ...adminCredentials, name: 'admin', password }
            })
            it('관리자를 생성한 뒤 원문 비밀번호로 로그인할 수 있다', async () => {
                await fix.module.get(AdminsService).create(createDto)
                await fix.httpClient
                    .post('/admins/login')
                    .body({ email: createDto.email, password })
                    .ok()
            })
        })

        describe('이메일에 대문자와 앞뒤 공백이 있으면', () => {
            let email: string
            beforeEach(() => {
                email = ' Admin.Name+Tag@Example.COM '
            })
            it('생성하면 공백을 제거한 소문자 이메일을 저장하고 반환한다', async () => {
                const admin = await createAdmin(fix, { email })
                expect(admin.email).toBe('admin.name+tag@example.com')
                expect(
                    await fix.module
                        .get(AdminsRepository)
                        .findForAuthentication({ email: 'admin.name+tag@example.com' })
                ).toMatchObject({ id: admin.id })
            })
        })

        describe('대소문자와 앞뒤 공백만 다른 생성 요청이 있으면', () => {
            let emails: string[]
            beforeEach(() => {
                emails = ['race@example.com', ' RACE@EXAMPLE.COM ']
            })
            it('동시에 생성하면 한 요청만 성공하고 나머지는 이메일 충돌 예외를 던진다', async () => {
                const results = await Promise.allSettled(
                    emails.map((email) => createAdmin(fix, { email }))
                )
                expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
                expect(results.filter((result) => result.status === 'rejected')).toEqual([
                    expect.objectContaining({ reason: expect.objectContaining({ status: 409 }) })
                ])
            })
        })

        it('관리자를 생성하면 생성된 정보를 반환한다', async () => {
            await expect(createAdmin(fix, adminCredentials)).resolves.toEqual(
                expect.objectContaining({
                    id: expect.any(String),
                    email: adminCredentials.email,
                    name: 'admin'
                })
            )
        })

        describe('관리자가 존재하면', () => {
            beforeEach(async () => {
                await createAdmin(fix, adminCredentials)
            })

            it('그 관리자의 이메일로 생성을 요청하면 409 예외를 던진다', async () => {
                await expect(createAdmin(fix, adminCredentials)).rejects.toMatchObject({
                    status: 409
                })
            })
        })

        describe('저장소에서 중복 키 이외의 오류가 발생하면', () => {
            let service: AdminsService
            let failure: Error
            beforeEach(() => {
                service = fix.module.get(AdminsService)
                const repository = fix.module.get(AdminsRepository)
                failure = new Error('storage unavailable')
                vi.spyOn(repository.collection, 'insertOne').mockRejectedValueOnce(failure)
            })
            it('관리자 생성을 요청하면 저장 오류를 그대로 던진다', async () => {
                await expect(service.create({ ...adminCredentials, name: 'admin' })).rejects.toBe(
                    failure
                )
            })
        })

        describe('생성할 관리자의 필수 필드가 null이면', () => {
            let service: AdminsService
            let invalidDto: Parameters<AdminsService['create']>[0]
            beforeEach(() => {
                service = fix.module.get(AdminsService)

                // HTTP를 거치지 않은 생성도 동일한 입력 검증을 적용한다.
                invalidDto = {
                    email: 'x@y.com',
                    name: null as unknown as string,
                    password: 'Example password 1!'
                }
            })
            it('관리자 생성을 요청하면 오류를 던지고 중복 이메일 충돌로 분류하지 않는다', async () => {
                // "그대로 던진다"의 핵심은 409로 변환되지 않는 것이므로 예외 타입까지 확인한다.
                const promise = service.create(invalidDto)
                await expect(promise).rejects.toThrow()
                await expect(promise).rejects.not.toBeInstanceOf(ConflictException)
            })
        })
    })

    describe('관리자 생성 명령', () => {
        describe.each([
            { condition: 'ASCII 15자', password: 'a'.repeat(15) },
            { condition: '이모지 128자', password: '🌱'.repeat(128) },
            { condition: '공백 15자', password: ' '.repeat(15) }
        ])('비밀번호에 $condition 값을 입력하면', ({ password }) => {
            let createDto: Parameters<typeof runAdminCreateScript>[1]
            beforeEach(() => {
                createDto = { name: 'CLI admin', email: '  Cli.Admin+Tag@Example.COM  ', password }
            })
            it('명령이 성공하고 같은 이메일 식별값과 원문 비밀번호로 로그인할 수 있다', async () => {
                const result = await runAdminCreateScript(fix, createDto)
                expect(result).toMatchObject({ exitCode: 0, stderr: '' })
                expect(result.stdout).toContain('Admin created: cli.admin+tag@example.com')

                const stored = await fix.module
                    .get(AdminsRepository)
                    .findForAuthentication({ email: 'cli.admin+tag@example.com' })

                expect(stored?.password).toMatch(/^\$argon2id\$v=19\$/)
                expect(stored?.password.split('$')[3]?.split(',').sort()).toEqual([
                    'm=19456',
                    'p=1',
                    't=2'
                ])

                await fix.httpClient
                    .post('/admins/login')
                    .body({ email: createDto.email, password })
                    .ok()
            })
        })

        describe.each([
            { condition: '이모지 14자', password: '🌱'.repeat(14) },
            { condition: '한글 129자', password: '가'.repeat(129) }
        ])('비밀번호에 $condition 값을 입력하면', ({ password }) => {
            let createDto: Parameters<typeof runAdminCreateScript>[1]
            beforeEach(() => {
                createDto = { ...adminCredentials, name: 'CLI admin', password }
            })
            it('명령이 실패하고 관리자를 저장하지 않는다', async () => {
                const result = await runAdminCreateScript(fix, createDto)
                expect(result.exitCode).toBe(1)
                expect(result.stderr).toContain(
                    'Password must contain 15 to 128 Unicode code points.'
                )
                expect(
                    await fix.module
                        .get(AdminsRepository)
                        .findForAuthentication({ email: createDto.email })
                ).toBeNull()
            })
        })

        describe('같은 식별값의 관리자가 이미 있으면', () => {
            let createDto: Parameters<typeof runAdminCreateScript>[1]
            beforeEach(async () => {
                await createAdmin(fix, adminCredentials)
                createDto = { ...adminCredentials, name: 'CLI admin', email: '  ADMIN@MAIL.COM  ' }
            })
            it('생성 명령이 실패하고 기존 관리자 한 명만 유지한다', async () => {
                const result = await runAdminCreateScript(fix, createDto)
                expect(result.exitCode).toBe(1)
                expect(result.stderr).toContain('E11000')
                expect(
                    await fix.module
                        .get(AdminsRepository)
                        .collection.countDocuments({ email: adminCredentials.email })
                ).toBe(1)
            })
        })
    })

    describe('AdminsService.remove', () => {
        describe('ID에 해당하는 관리자가 없으면', () => {
            let service: AdminsService
            let id: string
            beforeEach(() => {
                service = fix.module.get(AdminsService)
                id = nullObjectId
            })
            it('관리자를 삭제하면 관리자가 없다는 예외를 던진다', async () => {
                await expect(service.remove(id)).rejects.toThrow(
                    Errors.Mongo.DocumentNotFound(nullObjectId).message
                )
            })
        })
    })

    describe('PATCH /admins/me', () => {
        describe('관리자로 로그인했으면', () => {
            let admin: AdminDto
            let accessToken: string
            let refreshToken: string

            beforeEach(async () => {
                await createAdmin(fix, adminCredentials)
                ;({ accessToken, admin, refreshToken } = await loginAdmin(fix, adminCredentials))
            })

            it('이름을 수정하면 수정된 관리자를 반환한다', async () => {
                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ name: 'renamed' })
                    .ok({ expected: { ...admin, name: 'renamed' } })
            })

            it('본인 정보를 수정하면 DB에 저장한다', async () => {
                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ name: 'renamed' })
                    .ok()

                await fix.httpClient
                    .get('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok({ expected: { ...admin, name: 'renamed' } })
            })

            describe('비밀번호가 변경되었으면', () => {
                const newPassword = '변경한 비밀번호🌱'.repeat(10)

                beforeEach(async () => {
                    await fix.httpClient
                        .patch('/admins/me')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body({ password: newPassword })
                        .ok()
                })

                it('새 비밀번호로 로그인할 수 있다', async () => {
                    await fix.httpClient
                        .post('/admins/login')
                        .body({ email: adminCredentials.email, password: newPassword })
                        .ok({
                            expected: {
                                accessToken: expect.any(String),
                                refreshToken: expect.any(String)
                            }
                        })
                })

                it('기존 리프레시 토큰으로 갱신을 요청하면 401을 반환한다', async () => {
                    await fix.httpClient
                        .post('/admins/refresh')
                        .body({ refreshToken })
                        .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
                })

                it('기존 액세스 토큰으로 본인 정보를 조회할 수 있다', async () => {
                    await fix.httpClient
                        .get('/admins/me')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .ok({ expected: admin })
                })
            })

            it('이메일을 변경하면 변경된 이메일을 반환한다', async () => {
                await fix.httpClient
                    .patch('/admins/me')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body({ email: '  Renamed@Mail.COM  ' })
                    .ok({ expected: { ...admin, email: 'renamed@mail.com' } })

                await fix.httpClient
                    .post('/admins/login')
                    .body({ ...adminCredentials, email: ' RENAMED@MAIL.COM ' })
                    .ok()
            })

            describe.each([
                { condition: '이모지 14자', password: '🌱'.repeat(14) },
                { condition: '한글 129자', password: '가'.repeat(129) }
            ])('새 비밀번호에 $condition 값을 입력하면', ({ password }) => {
                let request: typeof fix.httpClient
                beforeEach(() => {
                    request = fix.httpClient
                        .patch('/admins/me')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body({ password })
                })
                it('변경을 요청하면 400을 반환하고 기존 비밀번호를 유지한다', async () => {
                    await request.badRequest()
                    await fix.httpClient.post('/admins/login').body(adminCredentials).ok()
                })
            })

            describe('새 비밀번호에 앞뒤 공백이 있으면', () => {
                let password: string
                beforeEach(() => {
                    password = '  updated password  '
                })
                it('변경하면 공백까지 일치하는 비밀번호로만 로그인할 수 있다', async () => {
                    await fix.httpClient
                        .patch('/admins/me')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body({ password })
                        .ok()
                    await fix.httpClient
                        .post('/admins/login')
                        .body({ ...adminCredentials, password })
                        .ok()
                    await fix.httpClient
                        .post('/admins/login')
                        .body({ ...adminCredentials, password: password.trim() })
                        .unauthorized({ expected: Errors.Auth.Unauthorized() })
                })
            })

            describe('다른 관리자가 존재하면', () => {
                beforeEach(async () => {
                    await createAdmin(fix, { email: 'a@mail.com', password: 'Example password 1!' })
                })
                it('그 관리자의 이메일로 변경을 요청하면 409를 반환한다', async () => {
                    await fix.httpClient
                        .patch('/admins/me')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body({ email: '  A@MAIL.COM  ' })
                        .conflict()
                })
            })
        })

        describe('인증 토큰이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.patch('/admins/me').body({ name: 'x' })
            })
            it('본인 정보 수정을 요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })
    })

    describe('AdminsService.update', () => {
        describe('관리자가 존재하고 저장소 갱신이 실패하도록 설정하면', () => {
            let created: AdminDto
            let service: AdminsService
            beforeEach(async () => {
                created = await createAdmin(fix, adminCredentials)

                service = fix.module.get(AdminsService)
                const repo = fix.module.get(AdminsRepository)
                vi.spyOn(repo.collection, 'findOneAndUpdate').mockRejectedValueOnce(
                    new Error('boom')
                )
            })
            it('수정을 요청하면 저장 오류를 전달한다', async () => {
                await expect(service.update(created.id, { name: 'x' })).rejects.toThrow('boom')
            })
        })

        describe('ID에 해당하는 관리자가 없으면', () => {
            let service: AdminsService
            let id: string
            beforeEach(() => {
                service = fix.module.get(AdminsService)
                id = nullObjectId
            })
            it('관리자를 수정하면 관리자가 없다는 예외를 던진다', async () => {
                await expect(service.update(id, { name: 'x' })).rejects.toThrow(
                    Errors.Mongo.DocumentNotFound(nullObjectId).message
                )
            })
        })
    })

    describe('로그인한 관리자 계정이 삭제되었으면', () => {
        let admin: AdminDto
        let accessToken: string
        let refreshToken: string

        beforeEach(async () => {
            admin = await createAdmin(fix, adminCredentials)
            ;({ accessToken, refreshToken } = await loginAdmin(fix, adminCredentials))
            await fix.module.get(AdminsService).remove(admin.id)
        })

        it('같은 이메일로 관리자를 다시 생성할 수 있다', async () => {
            await expect(createAdmin(fix, adminCredentials)).resolves.toEqual(
                expect.objectContaining({ email: adminCredentials.email })
            )
        })

        it('기존 리프레시 토큰으로 갱신을 요청하면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/admins/refresh')
                .body({ refreshToken })
                .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
        })

        it('기존 액세스 토큰으로 본인 수정을 요청하면 404를 반환한다', async () => {
            await fix.httpClient
                .patch('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({ name: 'x' })
                .notFound({ expected: Errors.Mongo.DocumentNotFound(admin.id) })
        })

        it('기존 액세스 토큰으로 본인 조회를 요청하면 404를 반환한다', async () => {
            await fix.httpClient
                .get('/admins/me')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .notFound({ expected: Errors.Mongo.MultipleDocumentsNotFound([admin.id]) })
        })
    })
})
