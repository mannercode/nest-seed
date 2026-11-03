import { omit } from '@mannercode/common'
import { HttpTestClient, nullObjectId, plainDate } from '@mannercode/testing'
import { type UserDto, UsersRepository, UsersService, UserSchema } from '#core'
import {
    buildCreateUserDto,
    createAndLoginUser,
    createUser,
    Errors,
    loginUser,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { ConflictException } from '@nestjs/common'

describe('UsersService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
    })
    afterEach(() => teardown?.())

    describe('POST /users', () => {
        describe.each([
            { condition: 'ASCII 14자', password: 'a'.repeat(14) },
            { condition: '이모지 14자', password: '🌱'.repeat(14) },
            { condition: 'ASCII 129자', password: 'a'.repeat(129) },
            { condition: '한글 129자', password: '가'.repeat(129) }
        ])('비밀번호에 $condition 값을 입력하면', ({ password }) => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post('/users').body(buildCreateUserDto({ password }))
            })
            it('가입을 요청하면 400을 반환하고 사용자를 저장하지 않는다', async () => {
                await request.badRequest()
                expect(
                    await fix.module
                        .get(UsersRepository)
                        .findForAuthentication({ email: 'name@mail.com' })
                ).toBeNull()
            })
        })

        describe.each([
            { condition: 'ASCII 15자', password: 'a'.repeat(15) },
            { condition: '이모지 15자', password: '🌱'.repeat(15) },
            { condition: '한글 128자', password: '가'.repeat(128) },
            { condition: '이모지 128자', password: '🌱'.repeat(128) },
            { condition: '공백 15자', password: ' '.repeat(15) }
        ])('비밀번호에 $condition 값을 입력하면', ({ password }) => {
            let createDto: ReturnType<typeof buildCreateUserDto>
            beforeEach(() => {
                createDto = buildCreateUserDto({ password })
            })
            it('가입한 뒤 원문 비밀번호로 로그인할 수 있다', async () => {
                await fix.httpClient.post('/users').body(createDto).created({ schema: UserSchema })
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: createDto.email, password })
                    .ok()
            })
        })

        describe('이메일에 대문자와 앞뒤 공백이 있으면', () => {
            let createDto: ReturnType<typeof buildCreateUserDto>
            beforeEach(() => {
                createDto = buildCreateUserDto({ email: '  First.Last+Tag@Example.COM  ' })
            })
            it('가입하면 공백을 제거한 소문자 이메일을 저장하고 반환한다', async () => {
                const { body } = await fix.httpClient
                    .post('/users')
                    .body(createDto)
                    .created({
                        schema: UserSchema,
                        expected: {
                            ...omit(createDto, ['password']),
                            email: 'first.last+tag@example.com',
                            id: expect.any(String),
                            photoAssetId: null
                        }
                    })
                expect(
                    await fix.module
                        .get(UsersRepository)
                        .findForAuthentication({ email: 'first.last+tag@example.com' })
                ).toMatchObject({ id: body.id })
            })
        })

        describe.each(['firstlast@example.com', 'first.last+tag@example.com'])(
            'first.last@example.com 계정이 있고 새 이메일이 %s이면',
            (email) => {
                let existing: UserDto
                beforeEach(async () => {
                    existing = await createUser(fix, { email: 'first.last@example.com' })
                })
                it('가입하면 점과 +태그가 다른 별도 계정을 생성한다', async () => {
                    const { body } = await fix.httpClient
                        .post('/users')
                        .body(buildCreateUserDto({ email }))
                        .created({ schema: UserSchema })
                    expect(body.email).toBe(email)
                    expect(body.id).not.toBe(existing.id)
                })
            }
        )

        it('사용자를 생성하면 생성된 정보를 반환한다', async () => {
            const createDto = buildCreateUserDto({ name: '2000-01-02' })

            await fix.httpClient
                .post('/users')
                .body(createDto)
                .created({
                    schema: UserSchema,
                    expected: {
                        ...omit(createDto, ['password']),
                        id: expect.any(String),
                        photoAssetId: null
                    }
                })
        })

        describe.each([
            { condition: 'name이 문자열이 아니면', invalid: { name: false } },
            { condition: 'password가 문자열이 아니면', invalid: { password: 1234 } }
        ])('$condition', ({ invalid }) => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/users')
                    .body({ ...buildCreateUserDto(), ...invalid })
            })
            it('가입을 요청하면 400을 반환한다', async () => {
                await request.badRequest()
            })
        })

        describe('사용자가 존재하면', () => {
            const email = 'user@mail.com'

            beforeEach(async () => {
                await createUser(fix, { email })
            })

            it('그 사용자의 이메일로 가입을 요청하면 409를 반환한다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body(buildCreateUserDto({ email: ` ${email.toUpperCase()} ` }))
                    .conflict({ expected: Errors.Users.EmailAlreadyExists(email) })
            })
        })

        describe('탈퇴한 사용자가 있으면', () => {
            const email = 'rejoin@mail.com'

            beforeEach(async () => {
                const user = await createUser(fix, { email })
                await fix.module.get(UsersService).deleteMany([user.id])
            })

            it('같은 이메일로 다시 가입할 수 있다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body(buildCreateUserDto({ email: ` ${email.toUpperCase()} ` }))
                    .created({ schema: UserSchema })
            })
        })

        describe('대소문자와 앞뒤 공백만 다른 가입 요청이 있으면', () => {
            let emails: string[]
            beforeEach(() => {
                emails = ['race@mail.com', 'RACE@MAIL.COM', ' race@mail.com ', ' Race@Mail.Com ']
            })
            it(
                '동시에 가입을 요청하면 하나만 201을 반환하고 나머지는 409를 반환한다',
                async () => {
                    const count = emails.length
                    const serverUrl = fix.httpClient.serverUrl

                    const statuses = await Promise.all(
                        emails.map(async (email) => {
                            const client = new HttpTestClient(serverUrl)
                            const response = await client
                                .post('/users')
                                .body(buildCreateUserDto({ email }))
                                .sendRaw()
                            return response.status
                        })
                    )

                    const createdCount = statuses.filter((s) => s === 201).length
                    const conflictCount = statuses.filter((s) => s === 409).length
                    const otherStatuses = statuses.filter((s) => s !== 201 && s !== 409)

                    expect(createdCount).toBe(1)
                    expect(conflictCount).toBe(count - 1)
                    // 동시 삽입의 중복 키 오류는 409로 변환되어야 한다.
                    // 500이 새어 나오면 변환 누락이므로
                    // 201/409 외 상태가 하나도 없음을 함께 단언한다.
                    expect(otherStatuses).toEqual([])
                    expect(
                        await fix.module
                            .get(UsersRepository)
                            .findForAuthentication({ email: 'race@mail.com' })
                    ).toMatchObject({ email: 'race@mail.com' })
                },
                30 * 1000
            )
        })

        describe('요청 본문에 필수 필드가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post('/users').body({})
            })
            it('가입을 요청하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.RequestValidation.Failed(expect.any(Array))
                })
            })
        })
    })

    describe('PATCH /users/me', () => {
        let user: UserDto
        let userAuth: { Authorization: string }

        beforeEach(async () => {
            user = await createUser(fix, { name: 'original-name' })
            const session = await loginUser(fix, {
                email: user.email,
                password: 'Example password 1!'
            })
            userAuth = { Authorization: `Bearer ${session.accessToken}` }
        })

        describe.each([
            { condition: '이모지 14자', password: '🌱'.repeat(14) },
            { condition: '한글 129자', password: '가'.repeat(129) }
        ])('새 비밀번호에 $condition 값을 입력하면', ({ password }) => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.patch('/users/me').headers(userAuth).body({ password })
            })
            it('변경을 요청하면 400을 반환하고 이전 비밀번호를 유지한다', async () => {
                await request.badRequest()
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: user.email, password: 'Example password 1!' })
                    .ok()
            })
        })

        describe('새 비밀번호에 앞뒤 공백이 있으면', () => {
            let password: string
            beforeEach(() => {
                password = '  updated password  '
            })
            it('변경하면 공백까지 일치하는 비밀번호로만 로그인할 수 있다', async () => {
                await fix.httpClient.patch('/users/me').headers(userAuth).body({ password }).ok()
                await fix.httpClient.post('/users/login').body({ email: user.email, password }).ok()
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: user.email, password: password.trim() })
                    .unauthorized({ expected: Errors.Auth.Unauthorized() })
            })
        })

        describe('새 이메일에 대문자와 앞뒤 공백이 있으면', () => {
            let email: string
            beforeEach(() => {
                email = '  Renamed+Tag@Example.COM  '
            })
            it('변경하면 소문자로 저장하고 같은 식별값의 이메일로 로그인할 수 있다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers(userAuth)
                    .body({ email })
                    .ok({
                        schema: UserSchema,
                        expected: { ...user, email: 'renamed+tag@example.com' }
                    })
                await fix.httpClient
                    .post('/users/login')
                    .body({ email, password: 'Example password 1!' })
                    .ok()
            })
        })

        describe('두 사용자가 같은 식별값의 이메일로 변경하려고 하면', () => {
            let requests: HttpTestClient[]
            beforeEach(async () => {
                const other = await createUser(fix, { email: 'other@mail.com' })
                const session = await loginUser(fix, {
                    email: other.email,
                    password: 'Example password 1!'
                })
                requests = [
                    new HttpTestClient(fix.httpClient.serverUrl)
                        .patch('/users/me')
                        .headers(userAuth)
                        .body({ email: ' Change@Mail.Com ' }),
                    new HttpTestClient(fix.httpClient.serverUrl)
                        .patch('/users/me')
                        .headers({ Authorization: `Bearer ${session.accessToken}` })
                        .body({ email: 'change@mail.com' })
                ]
            })
            it('동시에 변경을 요청하면 하나만 성공하고 나머지는 409를 반환한다', async () => {
                const responses = await Promise.all(requests.map((request) => request.sendRaw()))
                expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
                expect(
                    await fix.module
                        .get(UsersRepository)
                        .findForAuthentication({ email: 'change@mail.com' })
                ).toMatchObject({ email: 'change@mail.com' })
            })
        })

        it('사용자를 수정하면 수정된 정보를 반환한다', async () => {
            const updateDto = { birthDate: plainDate('1900-12-31'), email: 'new@mail.com' }

            await fix.httpClient
                .patch('/users/me')
                .headers(userAuth)
                .body(updateDto)
                .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
        })

        describe('수정할 필수 필드 값이 null이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.patch('/users/me').headers(userAuth).body({ name: null })
            })
            it('사용자 수정을 요청하면 400을 반환한다', async () => {
                await request.badRequest()
            })
        })

        it('사용자 정보를 수정하면 DB에 저장한다', async () => {
            const updateDto = { name: 'update-name' }
            await fix.httpClient
                .patch('/users/me')
                .headers(userAuth)
                .body(updateDto)
                .ok({ schema: UserSchema })

            await fix.httpClient
                .get('/users/me')
                .headers(userAuth)
                .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
        })

        describe('사용자의 비밀번호가 변경되었으면', () => {
            const newPassword = '변경한 비밀번호🌱'.repeat(10)
            let refreshToken: string

            beforeEach(async () => {
                ;({ refreshToken } = await loginUser(fix, {
                    email: user.email,
                    password: 'Example password 1!'
                }))
                await fix.httpClient
                    .patch('/users/me')
                    .headers(userAuth)
                    .body({ password: newPassword })
                    .ok({ schema: UserSchema })
            })

            it('새 비밀번호로 로그인할 수 있다', async () => {
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: user.email, password: newPassword })
                    .ok({
                        expected: {
                            accessToken: expect.any(String),
                            refreshToken: expect.any(String)
                        }
                    })
            })

            it('기존 리프레시 토큰으로 갱신을 요청하면 401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
            })
        })

        describe('다른 사용자가 존재하면', () => {
            const existingEmail = 'taken@mail.com'

            beforeEach(async () => {
                await createUser(fix, { email: existingEmail })
            })

            it('그 사용자의 이메일로 변경을 요청하면 409를 반환한다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers(userAuth)
                    .body({ email: existingEmail })
                    .conflict({ expected: Errors.Users.EmailAlreadyExists(existingEmail) })
            })
        })
    })

    describe('POST /users/refresh', () => {
        describe('로그인한 사용자가 탈퇴했으면', () => {
            let refreshToken: string

            beforeEach(async () => {
                const session = await createAndLoginUser(fix)
                refreshToken = session.refreshToken
                await fix.module.get(UsersService).deleteMany([session.user.id])
            })

            it('기존 리프레시 토큰으로 갱신을 요청하면 401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
            })
        })
    })

    describe('getMany', () => {
        let user: UserDto
        beforeEach(async () => {
            user = await createUser(fix)
        })
        it('ID로 조회하면 비밀번호를 제외한 사용자 정보를 반환한다', async () => {
            const users = await fix.module.get(UsersService).getMany([user.id])
            expect(users).toEqual([user])
            expect(users[0]).not.toHaveProperty('password')
        })
        describe('존재하지 않는 ID를 함께 요청하면', () => {
            it('조회하면 찾지 못한 ID가 포함된 예외를 던진다', async () => {
                await expect(
                    fix.module.get(UsersService).getMany([user.id, nullObjectId])
                ).rejects.toMatchObject({
                    response: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId])
                })
            })
        })
    })

    describe('update', () => {
        describe('ID에 해당하는 사용자가 없으면', () => {
            it('수정하면 사용자 없음 예외를 던진다', async () => {
                await expect(
                    fix.module.get(UsersService).update(nullObjectId, {})
                ).rejects.toMatchObject({ response: Errors.Mongo.DocumentNotFound(nullObjectId) })
            })
        })
    })

    describe('deleteMany', () => {
        describe('사용자가 존재하면', () => {
            let user: UserDto
            beforeEach(async () => {
                user = await createUser(fix)
            })
            it('삭제하면 이후 조회에서 사용자 없음 예외를 던진다', async () => {
                const service = fix.module.get(UsersService)
                await service.deleteMany([user.id])
                await expect(service.getMany([user.id])).rejects.toMatchObject({ status: 404 })
            })
        })
        describe('ID에 해당하는 사용자가 없으면', () => {
            it('삭제 요청은 오류 없이 완료한다', async () => {
                await expect(
                    fix.module.get(UsersService).deleteMany([nullObjectId])
                ).resolves.toBeUndefined()
            })
        })
    })

    describe('create', () => {
        describe('중복 키가 아닌 오류로 저장에 실패하면', () => {
            let service: UsersService
            let failure: Error

            beforeEach(() => {
                service = fix.module.get(UsersService)
                const repository = fix.module.get(UsersRepository)
                failure = new Error('storage unavailable')
                vi.spyOn(repository.collection, 'insertOne').mockRejectedValueOnce(failure)
            })

            it('사용자 생성을 요청하면 저장 오류를 그대로 던진다', async () => {
                const promise = service.create(buildCreateUserDto())
                await expect(promise).rejects.toBe(failure)
                await expect(promise).rejects.not.toBeInstanceOf(ConflictException)
            })
        })
    })

    describe('revokeAllForUser', () => {
        describe('사용자와 리프레시 세션이 없으면', () => {
            let service: UsersService
            let userId: string

            beforeEach(() => {
                service = fix.module.get(UsersService)
                userId = nullObjectId
            })

            it('사용자의 전체 세션 폐기를 요청하면 오류 없이 완료한다', async () => {
                await expect(service.revokeAllForUser(userId)).resolves.toBeUndefined()
            })
        })
    })
})
