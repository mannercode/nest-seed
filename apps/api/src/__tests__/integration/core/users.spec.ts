import type { UserDto } from 'core'
import { omit } from '@mannercode/common'
import { HttpTestClient, nullObjectId } from '@mannercode/testing'
import { buildCreateUserDto, createUser, Errors, type AppTestContext } from '../helpers'

describe('UsersService', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { UserJwtAuthGuard } = await import('gateway')
        fix = await createAppTestContext({ ignoreGuards: [UserJwtAuthGuard] })
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

        it('이미 존재하는 이메일이면 409를 반환한다', async () => {
            const email = 'user@mail.com'
            await createUser(fix, { email })

            const createDto = buildCreateUserDto({ email })

            await fix.httpClient
                .post('/users')
                .body(createDto)
                .conflict(Errors.Users.EmailAlreadyExists(createDto.email))
        })

        it(
            '같은 이메일로 동시 요청이 와도 1개만 201, 나머지는 409여야 한다 (500 노출 금지)',
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

        it('필수 필드가 누락되면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/users')
                .body({})
                .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
        })

        it('중복 키가 아닌 저장 오류는 ConflictException으로 바꾸지 않고 그대로 던진다', async () => {
            const { UsersService } = await import('core')
            const service = fix.module.get(UsersService)

            // `birthDate`에 잘못된 형식을 넣어 Mongoose의 CastError를 일으킵니다.
            // 컨트롤러의 class-validator가 먼저 검출하지 않도록 서비스를 직접 호출합니다.
            const invalidDto = buildCreateUserDto({ birthDate: 'not-a-date' as unknown as Date })

            await expect(service.create(invalidDto)).rejects.toThrow()
        })
    })

    describe('GET /users/:id', () => {
        it('ID에 해당하는 고객을 반환한다', async () => {
            const user = await createUser(fix)

            await fix.httpClient.get(`/users/${user.id}`).ok(user)
        })

        it('ID에 해당하는 고객이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/users/${nullObjectId}`)
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
        })
    })

    describe('PATCH /users/:id', () => {
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

        it('수정 내용이 DB에 저장된다', async () => {
            const updateDto = { name: 'update-name' }
            await fix.httpClient.patch(`/users/${user.id}`).body(updateDto).ok()

            await fix.httpClient.get(`/users/${user.id}`).ok({ ...user, ...updateDto })
        })

        it('ID에 해당하는 고객이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .patch(`/users/${nullObjectId}`)
                .body({})
                .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
        })

        it('다른 고객의 이메일로 변경하면 409를 반환한다', async () => {
            const existingEmail = 'taken@mail.com'
            await createUser(fix, { email: existingEmail })
            const target = await createUser(fix, { email: 'mine@mail.com' })

            await fix.httpClient
                .patch(`/users/${target.id}`)
                .body({ email: existingEmail })
                .conflict(Errors.Users.EmailAlreadyExists(existingEmail))
        })
    })

    describe('DELETE /users/:id', () => {
        it('고객이 존재하면 204를 반환한다', async () => {
            const user = await createUser(fix)

            await fix.httpClient.delete(`/users/${user.id}`).noContent()
        })

        it('삭제 후에는 조회 시 404가 반환된다', async () => {
            const user = await createUser(fix)

            await fix.httpClient.delete(`/users/${user.id}`).noContent()

            await fix.httpClient
                .get(`/users/${user.id}`)
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([user.id]))
        })

        it('고객이 없어도 204를 반환한다', async () => {
            await fix.httpClient.delete(`/users/${nullObjectId}`).noContent()
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

            await fix.httpClient.get('/users').ok(expected)
        })

        it('name 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/users')
                .query({ name: 'user-a' })
                .ok(buildExpectedPage([userA1, userA2]))
        })

        it('email 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/users')
                .query({ email: 'user-b' })
                .ok(buildExpectedPage([userB1, userB2]))
        })

        it('알 수 없는 쿼리 파라미터는 400을 반환한다', async () => {
            await fix.httpClient
                .get('/users')
                .query({ wrong: 'value' })
                .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
        })
    })

    describe('UsersRepository.existsByEmail', () => {
        it('같은 이메일의 고객이 있으면 true를 반환한다', async () => {
            const email = 'exists-check@mail.com'
            await createUser(fix, { email })

            const { UsersRepository } = await import('core')
            const repo = fix.module.get(UsersRepository)

            await expect(repo.existsByEmail(email)).resolves.toBe(true)
        })

        it('같은 이메일의 고객이 없으면 false를 반환한다', async () => {
            const { UsersRepository } = await import('core')
            const repo = fix.module.get(UsersRepository)

            await expect(repo.existsByEmail('does-not-exist@mail.com')).resolves.toBe(false)
        })
    })
})
