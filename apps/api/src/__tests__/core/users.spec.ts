import { omit, paginationResultSchema } from '@mannercode/common'
import { HttpTestClient, nullObjectId, plainDate } from '@mannercode/testing'
import { type UserDto, UsersRepository, UsersService, UserSchema } from '#core'
import {
    buildCreateUserDto,
    createAndLoginAdmin,
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
    let adminAuth: { Authorization: string }

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        const { accessToken } = await createAndLoginAdmin(fix)
        adminAuth = { Authorization: `Bearer ${accessToken}` }
    })
    afterEach(() => teardown?.())

    describe('POST /users', () => {
        it('생성된 사용자를 반환한다', async () => {
            const createDto = buildCreateUserDto({ name: '2000-01-02' })

            await fix.httpClient
                .post('/users')
                .body(createDto)
                .created({
                    schema: UserSchema,
                    expected: { ...omit(createDto, ['password']), id: expect.any(String) }
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
                    .body(buildCreateUserDto({ email }))
                    .conflict({ expected: Errors.Users.EmailAlreadyExists(email) })
            })
        })

        describe('탈퇴한 사용자가 있으면', () => {
            const email = 'rejoin@mail.com'

            beforeEach(async () => {
                const user = await createUser(fix, { email })
                await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()
            })

            it('같은 이메일로 다시 가입할 수 있다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body(buildCreateUserDto({ email }))
                    .created({ schema: UserSchema })
            })
        })

        it(
            '같은 이메일로 동시에 요청해도 하나만 201을 반환하고 나머지는 409를 반환한다',
            async () => {
                const email = 'race@mail.com'
                const count = 10
                const serverUrl = fix.httpClient.serverUrl

                const statuses = await Promise.all(
                    Array.from({ length: count }, async () => {
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
            },
            30 * 1000
        )

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

    describe('GET /users/:id', () => {
        describe('사용자가 존재하면', () => {
            let user: UserDto

            beforeEach(async () => {
                user = await createUser(fix)
            })

            it('해당 사용자를 반환한다', async () => {
                await fix.httpClient
                    .get(`/users/${user.id}`)
                    .headers(adminAuth)
                    .ok({ schema: UserSchema, expected: user })
            })
        })

        describe('ID에 해당하는 사용자가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get(`/users/${nullObjectId}`).headers(adminAuth)
            })
            it('사용자를 조회하면 404를 반환한다', async () => {
                await request.notFound({
                    expected: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId])
                })
            })
        })
    })

    describe('PATCH /users/:id', () => {
        let user: UserDto

        beforeEach(async () => {
            user = await createUser(fix, { name: 'original-name' })
        })

        it('수정된 사용자를 반환한다', async () => {
            const updateDto = { birthDate: plainDate('1900-12-31'), email: 'new@mail.com' }

            await fix.httpClient
                .patch(`/users/${user.id}`)
                .headers(adminAuth)
                .body(updateDto)
                .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
        })

        describe('수정할 필수 필드 값이 null이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .patch(`/users/${user.id}`)
                    .headers(adminAuth)
                    .body({ name: null })
            })
            it('사용자 수정을 요청하면 400을 반환한다', async () => {
                await request.badRequest()
            })
        })

        it('수정 내용이 DB에 저장된다', async () => {
            const updateDto = { name: 'update-name' }
            await fix.httpClient
                .patch(`/users/${user.id}`)
                .headers(adminAuth)
                .body(updateDto)
                .ok({ schema: UserSchema })

            await fix.httpClient
                .get(`/users/${user.id}`)
                .headers(adminAuth)
                .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
        })

        describe('ID에 해당하는 사용자가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.patch(`/users/${nullObjectId}`).headers(adminAuth).body({})
            })
            it('사용자 수정을 요청하면 404를 반환한다', async () => {
                await request.notFound({ expected: Errors.Mongo.DocumentNotFound(nullObjectId) })
            })
        })

        describe('사용자의 비밀번호가 변경되었으면', () => {
            const newPassword = 'newPassword'
            let refreshToken: string

            beforeEach(async () => {
                ;({ refreshToken } = await loginUser(fix, {
                    email: user.email,
                    password: 'password'
                }))
                await fix.httpClient
                    .patch(`/users/${user.id}`)
                    .headers(adminAuth)
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
                    .patch(`/users/${user.id}`)
                    .headers(adminAuth)
                    .body({ email: existingEmail })
                    .conflict({ expected: Errors.Users.EmailAlreadyExists(existingEmail) })
            })
        })
    })

    describe('DELETE /users/:id', () => {
        describe('사용자가 존재하면', () => {
            let user: UserDto

            beforeEach(async () => {
                user = await createUser(fix)
            })

            it('204를 반환하고 삭제 후 조회에는 404를 반환한다', async () => {
                await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()

                await fix.httpClient
                    .get(`/users/${user.id}`)
                    .headers(adminAuth)
                    .notFound({ expected: Errors.Mongo.MultipleDocumentsNotFound([user.id]) })
            })
        })

        describe('ID에 해당하는 사용자가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.delete(`/users/${nullObjectId}`).headers(adminAuth)
            })
            it('사용자 삭제를 요청하면 204를 반환한다', async () => {
                await request.noContent()
            })
        })
    })

    describe('POST /users/refresh', () => {
        describe('로그인한 사용자가 탈퇴했으면', () => {
            let refreshToken: string

            beforeEach(async () => {
                const session = await createAndLoginUser(fix)
                refreshToken = session.refreshToken
                await fix.httpClient
                    .delete(`/users/${session.user.id}`)
                    .headers(adminAuth)
                    .noContent()
            })

            it('기존 리프레시 토큰으로 갱신을 요청하면 401을 반환한다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
            })
        })
    })

    describe('일반 사용자로 로그인했으면', () => {
        let userAuth: { Authorization: string }
        let target: UserDto

        beforeEach(async () => {
            const { accessToken } = await createAndLoginUser(fix)
            userAuth = { Authorization: `Bearer ${accessToken}` }
            target = await createUser(fix, { email: 'target@mail.com' })
        })

        it('GET /users/:id 요청에 401을 반환한다', async () => {
            await fix.httpClient
                .get(`/users/${target.id}`)
                .headers(userAuth)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        it('PATCH /users/:id 요청에 401을 반환한다', async () => {
            await fix.httpClient
                .patch(`/users/${target.id}`)
                .headers(userAuth)
                .body({ name: 'hacked' })
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        it('DELETE /users/:id 요청에 401을 반환한다', async () => {
            await fix.httpClient
                .delete(`/users/${target.id}`)
                .headers(userAuth)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        it('GET /users 요청에 401을 반환한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(userAuth)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })
    })

    describe('인증 정보가 없으면', () => {
        let target: UserDto

        beforeEach(async () => {
            target = await createUser(fix, { email: 'target@mail.com' })
        })

        it('GET /users/:id 요청에 401을 반환한다', async () => {
            await fix.httpClient
                .get(`/users/${target.id}`)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })
    })

    describe('GET /users', () => {
        let userA1: UserDto
        let userA2: UserDto
        let userB1: UserDto
        let userB2: UserDto

        beforeEach(async () => {
            const createdUsers = await Promise.all([
                createUser(fix, { email: 'user-a1@mail.com', name: 'user-a1' }),
                createUser(fix, { email: 'user-a2@mail.com', name: 'user-a2' }),
                createUser(fix, { email: 'user-b1@mail.com', name: 'user-b1' }),
                createUser(fix, { email: 'user-b2@mail.com', name: 'user-b2' })
            ])
            userA1 = createdUsers[0]
            userA2 = createdUsers[1]
            userB1 = createdUsers[2]
            userB2 = createdUsers[3]
        })

        const buildExpectedPage = (users: UserDto[]) => ({
            items: expect.arrayContaining(users),
            page: expect.any(Number),
            size: expect.any(Number),
            total: users.length
        })

        describe('검색 조건이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/users').headers(adminAuth)
            })
            it('사용자 목록을 조회하면 전체 사용자 페이지를 반환한다', async () => {
                const expected = buildExpectedPage([userA1, userA2, userB1, userB2])

                await request.ok({ schema: paginationResultSchema(UserSchema), expected })
            })
        })

        describe('정렬이 이메일 오름차순이고 page와 size가 2이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/users')
                    .headers(adminAuth)
                    .query({ orderby: 'email:asc', page: '2', size: '2' })
            })
            it('목록을 조회하면 정렬과 페이지 조건에 맞는 사용자를 반환한다', async () => {
                await request.ok({
                    schema: paginationResultSchema(UserSchema),
                    expected: { items: [userB1, userB2], page: 2, size: 2, total: 4 }
                })
            })
        })

        describe('사용자 이름의 일부를 검색 조건으로 지정했으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/users').headers(adminAuth).query({ name: 'user-a' })
            })
            it('목록을 조회하면 이름에 해당 문자열이 포함된 사용자를 반환한다', async () => {
                await request.ok({
                    schema: paginationResultSchema(UserSchema),
                    expected: buildExpectedPage([userA1, userA2])
                })
            })
        })

        describe('검색할 이름에 대소문자가 다르고 접두어가 아닌 부분 문자열이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/users').headers(adminAuth).query({ name: 'SER-A' })
            })
            it('목록을 조회하면 대소문자를 무시하고 이름이 부분 일치하는 사용자를 반환한다', async () => {
                // 'SER-A'는 'user-a1'의 비접두어 부분 문자열 + 대문자라, 접두어·대소문자 구분
                // 매칭으로 바꾸는 회귀를 한 번에 잡는다.
                await request.ok({
                    schema: paginationResultSchema(UserSchema),
                    expected: buildExpectedPage([userA1, userA2])
                })
            })
        })

        describe('이메일의 일부를 검색 조건으로 지정했으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/users').headers(adminAuth).query({ email: 'user-b' })
            })
            it('목록을 조회하면 이메일에 해당 문자열이 포함된 사용자를 반환한다', async () => {
                await request.ok({
                    schema: paginationResultSchema(UserSchema),
                    expected: buildExpectedPage([userB1, userB2])
                })
            })
        })

        describe('정의하지 않은 쿼리 파라미터가 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/users').headers(adminAuth).query({ wrong: 'value' })
            })
            it('사용자 목록을 조회하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.RequestValidation.Failed(expect.any(Array))
                })
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

            it('저장 오류를 그대로 던진다', async () => {
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

            it('오류 없이 완료한다', async () => {
                await expect(service.revokeAllForUser(userId)).resolves.toBeUndefined()
            })
        })
    })
})
