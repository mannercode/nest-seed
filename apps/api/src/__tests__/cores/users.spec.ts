import type { UserDto, SearchUsersPageDto } from 'cores'
import { omit } from '@mannercode/common'
import { HttpTestClient, nullObjectId } from '@mannercode/testing'
import type { UsersFixture } from './users.fixture'
import { buildCreateUserDto, createUser, Errors } from '../__helpers__'

describe('UsersService', () => {
    let fix: UsersFixture

    beforeEach(async () => {
        const { createUsersFixture } = await import('./users.fixture')
        fix = await createUsersFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /users', () => {
        // 생성된 고객을 반환한다
        it('returns the created user', async () => {
            const createDto = buildCreateUserDto()

            await fix.httpClient
                .post('/users')
                .body(createDto)
                .created({ ...omit(createDto, ['password']), id: expect.any(String) })
        })

        // 이메일이 이미 존재할 때
        describe('when the email already exists', () => {
            const email = 'user@mail.com'

            beforeEach(async () => {
                await createUser(fix, { email })
            })

            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                const createDto = buildCreateUserDto({ email })

                await fix.httpClient
                    .post('/users')
                    .body(createDto)
                    .conflict(Errors.Users.EmailAlreadyExists(createDto.email))
            })
        })

        // 같은 이메일로 동시에 여러 요청이 들어올 때
        describe('when multiple requests create with the same email concurrently', () => {
            // 정확히 하나는 201 Created, 나머지는 전부 409 Conflict 여야 한다 (500 노출 금지)
            it(
                'accepts exactly one request and rejects others with 409 only',
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
                    expect(otherStatuses).toEqual([])
                },
                30 * 1000
            )
        })

        // 필수 필드가 누락되었을 때
        describe('when required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({})
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })

        // 중복 키 이외의 저장 오류가 발생할 때
        describe('when the repository rejects with a non-duplicate error', () => {
            // 오류를 그대로 전파한다 (ConflictException 으로 변환하지 않는다)
            it('propagates the error', async () => {
                const { UsersService } = await import('cores')
                const service = fix.module.get(UsersService)

                // birthDate 를 유효하지 않은 형식으로 넣어 Mongoose CastError 유발.
                // 컨트롤러 레벨의 class-validator 를 우회하기 위해 service 를 직접 호출한다.
                const invalidDto = buildCreateUserDto({
                    birthDate: 'not-a-date' as unknown as Date
                })

                await expect(service.create(invalidDto)).rejects.toThrow()
            })
        })
    })

    describe('GET /users/:id', () => {
        // 고객이 존재할 때
        describe('when the user exists', () => {
            let user: UserDto

            beforeEach(async () => {
                user = await createUser(fix)
            })

            // 고객을 반환한다
            it('returns the user', async () => {
                await fix.httpClient.get(`/users/${user.id}`).ok(user)
            })
        })

        // 고객이 존재하지 않을 때
        describe('when the user does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/users/${nullObjectId}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
            })
        })
    })

    describe('PATCH /users/:id', () => {
        // 고객이 존재할 때
        describe('when the user exists', () => {
            let user: UserDto

            beforeEach(async () => {
                user = await createUser(fix, { name: 'original-name' })
            })

            // 수정된 고객을 반환한다
            it('returns the updated user', async () => {
                const updateDto = { birthDate: new Date('1900-12-31'), email: 'new@mail.com' }

                await fix.httpClient
                    .patch(`/users/${user.id}`)
                    .body(updateDto)
                    .ok({ ...user, ...updateDto })
            })

            // 수정 내용이 저장된다
            it('persists the update', async () => {
                const updateDto = { name: 'update-name' }
                await fix.httpClient.patch(`/users/${user.id}`).body(updateDto).ok()

                await fix.httpClient.get(`/users/${user.id}`).ok({ ...user, ...updateDto })
            })
        })

        // 고객이 존재하지 않을 때
        describe('when the user does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/users/${nullObjectId}`)
                    .body({})
                    .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
            })
        })

        // 다른 고객의 이메일로 변경하려 할 때
        describe("when updating to another user's email", () => {
            const existingEmail = 'taken@mail.com'
            let target: UserDto

            beforeEach(async () => {
                await createUser(fix, { email: existingEmail })
                target = await createUser(fix, { email: 'mine@mail.com' })
            })

            // 409 Conflict를 반환한다
            it('returns 409 Conflict', async () => {
                await fix.httpClient
                    .patch(`/users/${target.id}`)
                    .body({ email: existingEmail })
                    .conflict(Errors.Users.EmailAlreadyExists(existingEmail))
            })
        })
    })

    describe('DELETE /users/:id', () => {
        // 고객이 존재할 때
        describe('when the user exists', () => {
            let user: UserDto

            beforeEach(async () => {
                user = await createUser(fix)
            })

            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/users/${user.id}`).noContent()
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/users/${user.id}`).noContent()

                await fix.httpClient
                    .get(`/users/${user.id}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([user.id]))
            })
        })

        // 고객이 존재하지 않을 때
        describe('when the user does not exist', () => {
            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/users/${nullObjectId}`).noContent()
            })
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

        // 쿼리가 제공되지 않을 때
        describe('when the query is not provided', () => {
            // 기본 고객 페이지를 반환한다
            it('returns the default page of users', async () => {
                const expected = buildExpectedPage([userA1, userA2, userB1, userB2])

                await fix.httpClient.get('/users').ok(expected)
            })
        })

        // 필터가 제공될 때
        describe('when the filter is provided', () => {
            const queryAndExpect = (query: SearchUsersPageDto, users: UserDto[]) =>
                fix.httpClient.get('/users').query(query).ok(buildExpectedPage(users))

            // 부분 이름 일치로 필터링된 고객을 반환한다
            it('returns users filtered by a partial name match', async () => {
                await queryAndExpect({ name: 'user-a' }, [userA1, userA2])
            })

            // 부분 이메일 일치로 필터링된 고객을 반환한다
            it('returns users filtered by a partial email match', async () => {
                await queryAndExpect({ email: 'user-b' }, [userB1, userB2])
            })
        })

        // 쿼리 파라미터가 유효하지 않을 때
        describe('when the query parameters are invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/users')
                    .query({ wrong: 'value' })
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })
    })

    describe('UsersRepository.existsByEmail', () => {
        const email = 'exists-check@mail.com'

        // 같은 이메일의 고객이 존재할 때
        describe('when a user with the email exists', () => {
            beforeEach(async () => {
                await createUser(fix, { email })
            })

            // true를 반환한다
            it('returns true', async () => {
                const { UsersRepository } = await import('cores')
                const repo = fix.module.get(UsersRepository)

                await expect(repo.existsByEmail(email)).resolves.toBe(true)
            })
        })

        // 같은 이메일의 고객이 없을 때
        describe('when no user with the email exists', () => {
            // false를 반환한다
            it('returns false', async () => {
                const { UsersRepository } = await import('cores')
                const repo = fix.module.get(UsersRepository)

                await expect(repo.existsByEmail('does-not-exist@mail.com')).resolves.toBe(false)
            })
        })
    })
})
