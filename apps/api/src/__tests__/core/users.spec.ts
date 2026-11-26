import { omit } from '@mannercode/common'
import { HttpTestClient, nullObjectId, plainDate } from '@mannercode/testing'
import { Collection } from 'mongodb'
import { type UserDto, UsersService, UserSchema } from '#core'
import {
    buildCreateUserDto,
    createAndLoginUser,
    createUser,
    expectedErrors,
    loginUser,
    type AppTestContext,
    createAppTestContext
} from '#test-helpers'
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
        ])('$condition 비밀번호를 입력하면', ({ password }) => {
            const invalidSignupBody = buildCreateUserDto({ password })

            it('400을 반환하고 비밀번호를 고치면 같은 이메일로 가입할 수 있다', async () => {
                await fix.httpClient.post('/users').body(invalidSignupBody).badRequest()
                await fix.httpClient
                    .post('/users')
                    .body(buildCreateUserDto())
                    .created({ schema: UserSchema })
            })
        })

        describe.each([
            { condition: 'ASCII 15자', password: 'a'.repeat(15) },
            { condition: '이모지 15자', password: '🌱'.repeat(15) },
            { condition: '한글 128자', password: '가'.repeat(128) },
            { condition: '이모지 128자', password: '🌱'.repeat(128) },
            { condition: '공백 15자', password: ' '.repeat(15) }
        ])('$condition 비밀번호를 입력하면', ({ password }) => {
            const createDto = buildCreateUserDto({ password })

            it('입력한 비밀번호로 로그인할 수 있다', async () => {
                await fix.httpClient.post('/users').body(createDto).created({ schema: UserSchema })
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: createDto.email, password })
                    .ok()
            })
        })

        describe('이메일에 대문자와 앞뒤 공백이 있으면', () => {
            const createDto = buildCreateUserDto({ email: '  First.Last+Tag@Example.COM  ' })

            it('공백을 제거한 소문자 이메일을 저장하고 반환한다', async () => {
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
                const { user } = await loginUser(fix, {
                    email: 'first.last+tag@example.com',
                    password: createDto.password
                })
                expect(user).toMatchObject({ id: body.id, email: 'first.last+tag@example.com' })
            })
        })

        describe.each([
            { difference: '점만 다른', email: 'firstlast@example.com' },
            { difference: '+태그만 다른', email: 'first.last+tag@example.com' }
        ])('기존 이메일과 $difference 주소로 가입하면', ({ email }) => {
            let existing: UserDto
            beforeEach(async () => {
                existing = await createUser(fix, { email: 'first.last@example.com' })
            })
            it('별도 계정을 생성한다', async () => {
                const { body } = await fix.httpClient
                    .post('/users')
                    .body(buildCreateUserDto({ email }))
                    .created({ schema: UserSchema })
                expect(body.email).toBe(email)
                expect(body.id).not.toBe(existing.id)
            })
        })

        it('생성된 사용자 정보를 반환한다', async () => {
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
            { condition: 'name이 문자열이 아니면', body: { ...buildCreateUserDto(), name: false } },
            {
                condition: 'password가 문자열이 아니면',
                body: { ...buildCreateUserDto(), password: 1234 }
            },
            {
                condition: '이메일 형식이 잘못되면',
                body: buildCreateUserDto({ email: 'not-an-email' })
            },
            { condition: '비밀번호가 없으면', body: omit(buildCreateUserDto(), ['password']) }
        ])('$condition', ({ body }) => {
            it('400을 반환한다', async () => {
                await fix.httpClient.post('/users').body(body).badRequest()
            })
        })

        describe('가입할 이메일이 이미 등록되어 있으면', () => {
            const email = 'user@mail.com'

            beforeEach(async () => {
                await createUser(fix, { email })
            })

            it('409를 반환한다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body(buildCreateUserDto({ email: ` ${email.toUpperCase()} ` }))
                    .conflict({ expected: expectedErrors.emailAlreadyExists(email) })
            })
        })

        describe('탈퇴한 사용자가 있으면', () => {
            const email = 'rejoin@mail.com'

            beforeEach(async () => {
                const { password } = buildCreateUserDto({ email })
                await createUser(fix, { email })
                const { accessToken } = await loginUser(fix, { email, password })
                await fix.httpClient
                    .delete('/users/me')
                    .headers({ Authorization: 'Bearer ' + accessToken })
                    .noContent()
            })

            it('같은 이메일로 다시 가입할 수 있다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body(buildCreateUserDto({ email: ` ${email.toUpperCase()} ` }))
                    .created({ schema: UserSchema })
            })
        })

        describe('대소문자와 앞뒤 공백만 다른 이메일로 동시에 가입하면', () => {
            const emails = ['race@mail.com', 'RACE@MAIL.COM', ' race@mail.com ', ' Race@Mail.Com ']

            it(
                '한 요청에만 201을, 나머지에는 409를 반환한다',
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
                    const { user } = await loginUser(fix, {
                        email: 'race@mail.com',
                        password: buildCreateUserDto().password
                    })
                    expect(user.email).toBe('race@mail.com')
                },
                30 * 1000
            )
        })

        describe('요청 본문이 빈 객체이면', () => {
            const emptyBody = {}

            it('400을 반환한다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body(emptyBody)
                    .badRequest({ expected: expectedErrors.validationFailed(expect.any(Array)) })
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
        ])('$condition 비밀번호로 바꾸면', ({ password }) => {
            const invalidPasswordUpdate = { password }

            it('400을 반환하고 이전 비밀번호를 유지한다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers(userAuth)
                    .body(invalidPasswordUpdate)
                    .badRequest()
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: user.email, password: 'Example password 1!' })
                    .ok()
            })
        })

        describe('새 비밀번호에 앞뒤 공백이 있으면', () => {
            const password = '  updated password  '

            it('공백까지 일치하는 비밀번호로만 로그인할 수 있다', async () => {
                await fix.httpClient.patch('/users/me').headers(userAuth).body({ password }).ok()
                await fix.httpClient.post('/users/login').body({ email: user.email, password }).ok()
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: user.email, password: password.trim() })
                    .unauthorized({ expected: expectedErrors.unauthorized })
            })
        })

        describe('새 이메일에 대문자와 앞뒤 공백이 있으면', () => {
            const email = '  Renamed+Tag@Example.COM  '

            it('앞뒤 공백을 뺀 소문자로 저장하고 입력한 이메일로 로그인할 수 있다', async () => {
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

        describe('두 사용자가 대소문자와 앞뒤 공백만 다른 이메일로 동시에 변경하면', () => {
            let attempts: { original: UserDto; headers: { Authorization: string }; email: string }[]
            const newEmail = 'change@mail.com'
            beforeEach(async () => {
                const other = await createUser(fix, { email: 'other@mail.com' })
                const session = await loginUser(fix, {
                    email: other.email,
                    password: 'Example password 1!'
                })
                attempts = [
                    { original: user, headers: userAuth, email: ' Change@Mail.Com ' },
                    {
                        original: other,
                        headers: { Authorization: 'Bearer ' + session.accessToken },
                        email: newEmail
                    }
                ]
            })
            it('한 계정만 변경에 성공하고 409를 받은 계정은 기존 이메일을 유지한다', async () => {
                const results = await Promise.all(
                    attempts.map(async (attempt) => {
                        const response = await new HttpTestClient(fix.httpClient.serverUrl)
                            .patch('/users/me')
                            .headers(attempt.headers)
                            .body({ email: attempt.email })
                            .sendRaw()
                        return { ...attempt, response }
                    })
                )
                expect(results.map(({ response }) => response.status).sort()).toEqual([200, 409])
                for (const { original, headers, response } of results) {
                    const expected =
                        response.status === 200 ? { ...original, email: newEmail } : original
                    if (response.status === 409)
                        expect(response.body).toEqual(expectedErrors.emailAlreadyExists(newEmail))
                    await fix.httpClient
                        .get('/users/me')
                        .headers(headers)
                        .ok({ schema: UserSchema, expected })
                }
            })
        })

        it('생년월일과 이메일만 바꾸면 기존 이름을 유지한다', async () => {
            const updateDto = { birthDate: plainDate('1900-12-31'), email: 'new@mail.com' }

            await fix.httpClient
                .patch('/users/me')
                .headers(userAuth)
                .body(updateDto)
                .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
        })

        describe('name이 null이면', () => {
            const bodyWithNullName = { name: null }

            it('400을 반환한다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers(userAuth)
                    .body(bodyWithNullName)
                    .badRequest()
            })
        })

        it('변경한 이름을 응답과 이후 본인 조회에 반영한다', async () => {
            const updateDto = { name: 'update-name' }
            await fix.httpClient
                .patch('/users/me')
                .headers(userAuth)
                .body(updateDto)
                .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })

            await fix.httpClient
                .get('/users/me')
                .headers(userAuth)
                .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
        })

        describe('비밀번호를 변경한 뒤', () => {
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

            it('기존 리프레시 토큰으로 갱신하면 401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .unauthorized({ expected: expectedErrors.refreshTokenInvalid })
            })
        })

        describe('새 이메일을 다른 사용자가 쓰고 있으면', () => {
            const existingEmail = 'taken@mail.com'

            beforeEach(async () => {
                await createUser(fix, { email: existingEmail })
            })

            it('409를 반환한다', async () => {
                await fix.httpClient
                    .patch('/users/me')
                    .headers(userAuth)
                    .body({ email: existingEmail })
                    .conflict({ expected: expectedErrors.emailAlreadyExists(existingEmail) })
            })
        })
    })

    describe('POST /users/refresh', () => {
        describe('탈퇴 전에 발급한 리프레시 토큰이면', () => {
            let refreshToken: string

            beforeEach(async () => {
                const session = await createAndLoginUser(fix)
                refreshToken = session.refreshToken
                await fix.httpClient
                    .delete('/users/me')
                    .headers({ Authorization: 'Bearer ' + session.accessToken })
                    .noContent()
            })

            it('401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .unauthorized({ expected: expectedErrors.refreshTokenInvalid })
            })
        })
    })

    describe('getMany', () => {
        let user: UserDto
        beforeEach(async () => {
            user = await createUser(fix)
        })
        it('비밀번호를 제외한 사용자 정보를 반환한다', async () => {
            const users = await fix.module.get(UsersService).getMany([user.id])
            expect(users).toEqual([user])
            expect(users[0]).not.toHaveProperty('password')
        })
        describe('요청한 ID 중 일부가 존재하지 않으면', () => {
            it('누락된 ID를 담은 예외를 던진다', async () => {
                await expect(
                    fix.module.get(UsersService).getMany([user.id, nullObjectId])
                ).rejects.toMatchObject({
                    response: expectedErrors.multipleDocumentsNotFound([nullObjectId])
                })
            })
        })
    })

    describe('update', () => {
        describe('ID에 해당하는 사용자가 없으면', () => {
            it('사용자 없음 예외를 던진다', async () => {
                await expect(
                    fix.module.get(UsersService).update(nullObjectId, {})
                ).rejects.toMatchObject({ response: expectedErrors.documentNotFound(nullObjectId) })
            })
        })
    })

    describe('deleteMany', () => {
        describe('사용자가 존재하면', () => {
            let user: UserDto
            beforeEach(async () => {
                user = await createUser(fix)
            })
            it('이후 조회에서 사용자 없음 예외를 던진다', async () => {
                const service = fix.module.get(UsersService)
                await service.deleteMany([user.id])
                await expect(service.getMany([user.id])).rejects.toMatchObject({ status: 404 })
            })
        })
        describe('ID에 해당하는 사용자가 없으면', () => {
            it('오류 없이 끝난다', async () => {
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
                failure = new Error('storage unavailable')
                vi.spyOn(Collection.prototype, 'insertOne').mockRejectedValueOnce(failure)
            })

            it('저장 오류를 그대로 던진다', async () => {
                const promise = service.create(buildCreateUserDto())
                await expect(promise).rejects.toBe(failure)
                await expect(promise).rejects.not.toBeInstanceOf(ConflictException)
            })
        })
    })
})
