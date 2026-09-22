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
        it('생성된 고객을 반환한다', async () => {
            const createDto = buildCreateUserDto({ name: '2000-01-02' })

            await fix.httpClient
                .post('/users')
                .body(createDto)
                .created({
                    schema: UserSchema,
                    expected: { ...omit(createDto, ['password']), id: expect.any(String) }
                })
        })

        it.each([{ name: false }, { password: 1234 }])(
            '문자열 필드의 잘못된 타입 %j는 400을 반환한다',
            async (invalid) => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...buildCreateUserDto(), ...invalid })
                    .badRequest()
            }
        )

        it('이미 존재하는 이메일이면 409를 반환한다', async () => {
            const email = 'user@mail.com'
            await createUser(fix, { email })

            const createDto = buildCreateUserDto({ email })

            await fix.httpClient
                .post('/users')
                .body(createDto)
                .conflict({ expected: Errors.Users.EmailAlreadyExists(createDto.email) })
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

        it('필수 필드가 누락되면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/users')
                .body({})
                .badRequest({ expected: Errors.RequestValidation.Failed(expect.any(Array)) })
        })

        it('중복 키가 아닌 저장 오류는 ConflictException으로 바꾸지 않고 그대로 던진다', async () => {
            const service = fix.module.get(UsersService)
            const repository = fix.module.get(UsersRepository)
            const failure = new Error('storage unavailable')
            vi.spyOn(repository.collection, 'insertOne').mockRejectedValueOnce(failure)

            // "그대로 던진다"의 핵심은 409로 변환되지 않는 것이므로 예외 타입까지 확인한다.
            const promise = service.create(buildCreateUserDto())
            await expect(promise).rejects.toBe(failure)
            await expect(promise).rejects.not.toBeInstanceOf(ConflictException)
        })
    })

    describe('GET /users/:id', () => {
        it('ID에 해당하는 고객을 반환한다', async () => {
            const user = await createUser(fix)

            await fix.httpClient
                .get(`/users/${user.id}`)
                .headers(adminAuth)
                .ok({ schema: UserSchema, expected: user })
        })

        it('ID에 해당하는 고객이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/users/${nullObjectId}`)
                .headers(adminAuth)
                .notFound({ expected: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId]) })
        })
    })

    describe('PATCH /users/:id', () => {
        let user: UserDto

        beforeEach(async () => {
            user = await createUser(fix, { name: 'original-name' })
        })

        it('수정된 고객을 반환한다', async () => {
            const updateDto = { birthDate: plainDate('1900-12-31'), email: 'new@mail.com' }

            await fix.httpClient
                .patch(`/users/${user.id}`)
                .headers(adminAuth)
                .body(updateDto)
                .ok({ schema: UserSchema, expected: { ...user, ...updateDto } })
        })

        it('필수 필드를 null로 바꾸는 요청은 400을 반환한다', async () => {
            await fix.httpClient
                .patch(`/users/${user.id}`)
                .headers(adminAuth)
                .body({ name: null })
                .badRequest()
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

        it('ID에 해당하는 고객이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .patch(`/users/${nullObjectId}`)
                .headers(adminAuth)
                .body({})
                .notFound({ expected: Errors.Mongo.DocumentNotFound(nullObjectId) })
        })

        describe('password를 변경하면', () => {
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

            it('새 password로 로그인할 수 있다', async () => {
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

            it('기존 리프레시 토큰은 더 이상 갱신되지 않는다', async () => {
                await fix.httpClient
                    .post('/users/refresh')
                    .body({ refreshToken })
                    .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
            })
        })

        it('다른 고객의 이메일로 변경하면 409를 반환한다', async () => {
            const existingEmail = 'taken@mail.com'
            await createUser(fix, { email: existingEmail })
            const target = await createUser(fix, { email: 'mine@mail.com' })

            await fix.httpClient
                .patch(`/users/${target.id}`)
                .headers(adminAuth)
                .body({ email: existingEmail })
                .conflict({ expected: Errors.Users.EmailAlreadyExists(existingEmail) })
        })
    })

    describe('DELETE /users/:id', () => {
        it('204를 반환하고 삭제 후 조회에는 404를 반환한다', async () => {
            const user = await createUser(fix)

            await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()

            await fix.httpClient
                .get(`/users/${user.id}`)
                .headers(adminAuth)
                .notFound({ expected: Errors.Mongo.MultipleDocumentsNotFound([user.id]) })
        })

        it('고객이 없어도 204를 반환한다', async () => {
            await fix.httpClient.delete(`/users/${nullObjectId}`).headers(adminAuth).noContent()
        })

        it('탈퇴한 고객의 이메일로 다시 가입할 수 있다', async () => {
            const email = 'rejoin@mail.com'
            const user = await createUser(fix, { email })

            await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()

            await fix.httpClient
                .post('/users')
                .body(buildCreateUserDto({ email }))
                .created({ schema: UserSchema })
        })

        it('삭제된 고객의 리프레시 토큰은 더 이상 갱신되지 않는다', async () => {
            const { user, refreshToken } = await createAndLoginUser(fix)

            await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized({ expected: Errors.JwtAuth.RefreshTokenInvalid() })
        })

        it('회수할 세션이 없으면 계정 존재 여부와 무관하게 완료한다', async () => {
            const service = fix.module.get(UsersService)
            await expect(service.revokeAllForUser(nullObjectId)).resolves.toBeUndefined()
        })
    })

    describe('인가 경계', () => {
        let userAuth: { Authorization: string }
        let target: UserDto

        beforeEach(async () => {
            const { accessToken } = await createAndLoginUser(fix)
            userAuth = { Authorization: `Bearer ${accessToken}` }
            target = await createUser(fix, { email: 'target@mail.com' })
        })

        it('user 토큰으로 GET /users/:id에 접근하면 401을 반환한다', async () => {
            await fix.httpClient
                .get(`/users/${target.id}`)
                .headers(userAuth)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        it('user 토큰으로 PATCH /users/:id에 접근하면 401을 반환한다', async () => {
            await fix.httpClient
                .patch(`/users/${target.id}`)
                .headers(userAuth)
                .body({ name: 'hacked' })
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        it('user 토큰으로 DELETE /users/:id에 접근하면 401을 반환한다', async () => {
            await fix.httpClient
                .delete(`/users/${target.id}`)
                .headers(userAuth)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        it('user 토큰으로 GET /users 목록에 접근하면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(userAuth)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
        })

        it('Authorization 헤더가 없으면 401을 반환한다', async () => {
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

        it('쿼리가 없으면 전체 고객 페이지를 반환한다', async () => {
            const expected = buildExpectedPage([userA1, userA2, userB1, userB2])

            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .ok({ schema: paginationResultSchema(UserSchema), expected })
        })

        it('정렬과 페이지 조건에 맞는 고객을 반환한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .query({ orderby: 'email:asc', page: '2', size: '2' })
                .ok({
                    schema: paginationResultSchema(UserSchema),
                    expected: { items: [userB1, userB2], page: 2, size: 2, total: 4 }
                })
        })

        it('name 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .query({ name: 'user-a' })
                .ok({
                    schema: paginationResultSchema(UserSchema),
                    expected: buildExpectedPage([userA1, userA2])
                })
        })

        it('name 검색은 대소문자를 무시한 부분 문자열로 일치시킨다', async () => {
            // 'SER-A'는 'user-a1'의 비접두어 부분 문자열 + 대문자라, 접두어·대소문자 구분
            // 매칭으로 바꾸는 회귀를 한 번에 잡는다.
            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .query({ name: 'SER-A' })
                .ok({
                    schema: paginationResultSchema(UserSchema),
                    expected: buildExpectedPage([userA1, userA2])
                })
        })

        it('email 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .query({ email: 'user-b' })
                .ok({
                    schema: paginationResultSchema(UserSchema),
                    expected: buildExpectedPage([userB1, userB2])
                })
        })

        it('알 수 없는 쿼리 파라미터는 400을 반환한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .query({ wrong: 'value' })
                .badRequest({ expected: Errors.RequestValidation.Failed(expect.any(Array)) })
        })
    })
})
