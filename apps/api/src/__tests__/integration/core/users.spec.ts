import type { UserDto, SearchUsersPageDto } from 'core'
import { omit } from '@mannercode/common'
import { HttpTestClient, nullObjectId } from '@mannercode/testing'
import type { UsersFixture } from './users.fixture'
import { buildCreateUserDto, createUser, Errors } from '../helpers'

describe('UsersService', () => {
    let fix: UsersFixture

    beforeEach(async () => {
        const { createUsersFixture } = await import('./users.fixture')
        fix = await createUsersFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /users', () => {
        it('생성된 고객을 반환한다', async () => {
            const createDto = buildCreateUserDto()

            await fix.httpClient
                .post('/users')
                .body(createDto)
                .created({ ...omit(createDto, ['password']), id: expect.any(String) })
        })

        describe('이메일이 이미 존재할 때', () => {
            const email = 'user@mail.com'

            beforeEach(async () => {
                await createUser(fix, { email })
            })

            it('409 Conflict를 반환한다', async () => {
                const createDto = buildCreateUserDto({ email })

                await fix.httpClient
                    .post('/users')
                    .body(createDto)
                    .conflict(Errors.Users.EmailAlreadyExists(createDto.email))
            })
        })

        describe('같은 이메일로 동시에 여러 요청이 들어올 때', () => {
            it(
                '정확히 하나는 201 Created, 나머지는 전부 409 Conflict 여야 한다 (500 노출 금지)',
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

        describe('필수 필드가 누락되었을 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({})
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })

        describe('중복 키 이외의 저장 오류가 발생할 때', () => {
            it('오류를 그대로 전파한다 (ConflictException 으로 변환하지 않는다)', async () => {
                const { UsersService } = await import('core')
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
        describe('고객이 존재할 때', () => {
            let user: UserDto

            beforeEach(async () => {
                user = await createUser(fix)
            })

            it('고객을 반환한다', async () => {
                await fix.httpClient.get(`/users/${user.id}`).ok(user)
            })
        })

        describe('고객이 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                await fix.httpClient
                    .get(`/users/${nullObjectId}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
            })
        })
    })

    describe('PATCH /users/:id', () => {
        describe('고객이 존재할 때', () => {
            let user: UserDto

            beforeEach(async () => {
                user = await createUser(fix, { name: 'original-name' })
            })

            it('수정된 고객을 반환한다', async () => {
                const updateDto = { birthDate: new Date('1900-12-31'), email: 'new@mail.com' }

                await fix.httpClient
                    .patch(`/users/${user.id}`)
                    .body(updateDto)
                    .ok({ ...user, ...updateDto })
            })

            it('수정 내용이 저장된다', async () => {
                const updateDto = { name: 'update-name' }
                await fix.httpClient.patch(`/users/${user.id}`).body(updateDto).ok()

                await fix.httpClient.get(`/users/${user.id}`).ok({ ...user, ...updateDto })
            })
        })

        describe('고객이 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                await fix.httpClient
                    .patch(`/users/${nullObjectId}`)
                    .body({})
                    .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
            })
        })

        describe('다른 고객의 이메일로 변경하려 할 때', () => {
            const existingEmail = 'taken@mail.com'
            let target: UserDto

            beforeEach(async () => {
                await createUser(fix, { email: existingEmail })
                target = await createUser(fix, { email: 'mine@mail.com' })
            })

            it('409 Conflict를 반환한다', async () => {
                await fix.httpClient
                    .patch(`/users/${target.id}`)
                    .body({ email: existingEmail })
                    .conflict(Errors.Users.EmailAlreadyExists(existingEmail))
            })
        })
    })

    describe('DELETE /users/:id', () => {
        describe('고객이 존재할 때', () => {
            let user: UserDto

            beforeEach(async () => {
                user = await createUser(fix)
            })

            it('204 No Content를 반환한다', async () => {
                await fix.httpClient.delete(`/users/${user.id}`).noContent()
            })

            it('삭제가 저장된다', async () => {
                await fix.httpClient.delete(`/users/${user.id}`).noContent()

                await fix.httpClient
                    .get(`/users/${user.id}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([user.id]))
            })
        })

        describe('고객이 존재하지 않을 때', () => {
            it('204 No Content를 반환한다', async () => {
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

        describe('쿼리가 제공되지 않을 때', () => {
            it('기본 고객 페이지를 반환한다', async () => {
                const expected = buildExpectedPage([userA1, userA2, userB1, userB2])

                await fix.httpClient.get('/users').ok(expected)
            })
        })

        describe('필터가 제공될 때', () => {
            const queryAndExpect = (query: SearchUsersPageDto, users: UserDto[]) =>
                fix.httpClient.get('/users').query(query).ok(buildExpectedPage(users))

            it('부분 이름 일치로 필터링된 고객을 반환한다', async () => {
                await queryAndExpect({ name: 'user-a' }, [userA1, userA2])
            })

            it('부분 이메일 일치로 필터링된 고객을 반환한다', async () => {
                await queryAndExpect({ email: 'user-b' }, [userB1, userB2])
            })
        })

        describe('쿼리 파라미터가 유효하지 않을 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient
                    .get('/users')
                    .query({ wrong: 'value' })
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })
    })

    describe('UsersRepository.existsByEmail', () => {
        const email = 'exists-check@mail.com'

        describe('같은 이메일의 고객이 존재할 때', () => {
            beforeEach(async () => {
                await createUser(fix, { email })
            })

            it('true를 반환한다', async () => {
                const { UsersRepository } = await import('core')
                const repo = fix.module.get(UsersRepository)

                await expect(repo.existsByEmail(email)).resolves.toBe(true)
            })
        })

        describe('같은 이메일의 고객이 없을 때', () => {
            it('false를 반환한다', async () => {
                const { UsersRepository } = await import('core')
                const repo = fix.module.get(UsersRepository)

                await expect(repo.existsByEmail('does-not-exist@mail.com')).resolves.toBe(false)
            })
        })
    })
})
