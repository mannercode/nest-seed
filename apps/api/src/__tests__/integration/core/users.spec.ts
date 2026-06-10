import type { UserDto } from 'core'
import { omit } from '@mannercode/common'
import { HttpTestClient, nullObjectId } from '@mannercode/testing'
import {
    buildCreateUserDto,
    createAndLoginAdmin,
    createAndLoginUser,
    createUser,
    Errors,
    type AppTestContext
} from '../helpers'

describe('UsersService', () => {
    let fix: AppTestContext
    // 임의 사용자 대상 작업(GET/PATCH/DELETE /users/:id, GET /users)은 운영자 전용이라 admin 토큰으로 호출한다.
    // 가드를 끄지 않고 실제 토큰을 쓰므로, 인가 경계가 깨지면(예: user 토큰이 통과) 테스트가 실패한다.
    let adminAuth: { Authorization: string }

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
        const { accessToken } = await createAndLoginAdmin(fix)
        adminAuth = { Authorization: `Bearer ${accessToken}` }
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
                .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
        })

        it('중복 키가 아닌 저장 오류는 ConflictException으로 바꾸지 않고 그대로 던진다', async () => {
            const { UsersService } = await import('core')
            const { ConflictException } = await import('@nestjs/common')
            const service = fix.module.get(UsersService)

            // `birthDate`에 잘못된 형식을 넣어 Mongoose의 CastError를 일으킨다.
            // 컨트롤러의 class-validator가 먼저 검출하지 않도록 서비스를 직접 호출한다.
            const invalidDto = buildCreateUserDto({ birthDate: 'not-a-date' as unknown as Date })

            // "그대로 던진다"의 핵심은 409로 변환되지 않는 것이므로 예외 타입까지 확인한다.
            const promise = service.create(invalidDto)
            await expect(promise).rejects.toThrow()
            await expect(promise).rejects.not.toBeInstanceOf(ConflictException)
        })
    })

    describe('GET /users/:id', () => {
        it('ID에 해당하는 고객을 반환한다', async () => {
            const user = await createUser(fix)

            await fix.httpClient.get(`/users/${user.id}`).headers(adminAuth).ok(user)
        })

        it('ID에 해당하는 고객이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/users/${nullObjectId}`)
                .headers(adminAuth)
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
                .headers(adminAuth)
                .body(updateDto)
                .ok({ ...user, ...updateDto })
        })

        it('수정 내용이 DB에 저장된다', async () => {
            const updateDto = { name: 'update-name' }
            await fix.httpClient.patch(`/users/${user.id}`).headers(adminAuth).body(updateDto).ok()

            await fix.httpClient
                .get(`/users/${user.id}`)
                .headers(adminAuth)
                .ok({ ...user, ...updateDto })
        })

        it('ID에 해당하는 고객이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .patch(`/users/${nullObjectId}`)
                .headers(adminAuth)
                .body({})
                .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
        })

        it('password를 바꾸면 새 password로 로그인할 수 있다', async () => {
            await fix.httpClient
                .patch(`/users/${user.id}`)
                .headers(adminAuth)
                .body({ password: 'newPassword' })
                .ok()

            await fix.httpClient
                .post('/users/login')
                .body({ email: user.email, password: 'newPassword' })
                .ok({ accessToken: expect.any(String), refreshToken: expect.any(String) })
        })

        it('password를 바꾸면 기존 리프레시 토큰은 더 이상 갱신되지 않는다', async () => {
            const session = await createAndLoginUser(fix)

            await fix.httpClient
                .patch(`/users/${session.user.id}`)
                .headers(adminAuth)
                .body({ password: 'newPassword' })
                .ok()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken: session.refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })

        it('다른 고객의 이메일로 변경하면 409를 반환한다', async () => {
            const existingEmail = 'taken@mail.com'
            await createUser(fix, { email: existingEmail })
            const target = await createUser(fix, { email: 'mine@mail.com' })

            await fix.httpClient
                .patch(`/users/${target.id}`)
                .headers(adminAuth)
                .body({ email: existingEmail })
                .conflict(Errors.Users.EmailAlreadyExists(existingEmail))
        })
    })

    describe('DELETE /users/:id', () => {
        it('고객이 존재하면 204를 반환한다', async () => {
            const user = await createUser(fix)

            await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()
        })

        it('삭제 후에는 조회 시 404가 반환된다', async () => {
            const user = await createUser(fix)

            await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()

            await fix.httpClient
                .get(`/users/${user.id}`)
                .headers(adminAuth)
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([user.id]))
        })

        it('고객이 없어도 204를 반환한다', async () => {
            await fix.httpClient.delete(`/users/${nullObjectId}`).headers(adminAuth).noContent()
        })

        it('탈퇴한 고객의 이메일로 다시 가입할 수 있다', async () => {
            const email = 'rejoin@mail.com'
            const user = await createUser(fix, { email })

            await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()

            await fix.httpClient.post('/users').body(buildCreateUserDto({ email })).created()
        })

        it('삭제된 고객의 리프레시 토큰은 더 이상 갱신되지 않는다', async () => {
            const { user, refreshToken } = await createAndLoginUser(fix)

            await fix.httpClient.delete(`/users/${user.id}`).headers(adminAuth).noContent()

            await fix.httpClient
                .post('/users/refresh')
                .body({ refreshToken })
                .unauthorized(Errors.JwtAuth.RefreshTokenInvalid())
        })
    })

    // 임의 ID를 다루는 핸들러는 admin 전용이다. user 토큰이나 무인증으로는 통과할 수 없어야
    // "임의 ID = 운영자" 경계가 코드로 강제됨을 보장한다(가드를 끄면 이 검증이 사라진다).
    // user 토큰은 admin 가드와 secret이 달라 서명 검증에 실패하고, AuthGuard가 검증 실패를
    // 401로 매핑하므로 401이 된다(무인증·만료와 같다). 이 동작은 admin-auth.spec과 동일하다.
    describe('인가 경계', () => {
        let userAuth: { Authorization: string }
        let target: UserDto

        beforeEach(async () => {
            const { accessToken } = await createAndLoginUser(fix)
            userAuth = { Authorization: `Bearer ${accessToken}` }
            target = await createUser(fix, { email: 'target@mail.com' })
        })

        it('user 토큰으로 GET /users/:id에 접근하면 통과하지 못한다', async () => {
            await fix.httpClient
                .get(`/users/${target.id}`)
                .headers(userAuth)
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('user 토큰으로 PATCH /users/:id에 접근하면 통과하지 못한다', async () => {
            await fix.httpClient
                .patch(`/users/${target.id}`)
                .headers(userAuth)
                .body({ name: 'hacked' })
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('user 토큰으로 DELETE /users/:id에 접근하면 통과하지 못한다', async () => {
            await fix.httpClient
                .delete(`/users/${target.id}`)
                .headers(userAuth)
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('user 토큰으로 GET /users 목록에 접근하면 통과하지 못한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(userAuth)
                .unauthorized(Errors.Auth.Unauthorized())
        })

        it('Authorization 헤더가 없으면 401을 반환한다', async () => {
            await fix.httpClient.get(`/users/${target.id}`).unauthorized(Errors.Auth.Unauthorized())
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

            await fix.httpClient.get('/users').headers(adminAuth).ok(expected)
        })

        it('name 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .query({ name: 'user-a' })
                .ok(buildExpectedPage([userA1, userA2]))
        })

        it('email 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .query({ email: 'user-b' })
                .ok(buildExpectedPage([userB1, userB2]))
        })

        it('알 수 없는 쿼리 파라미터는 400을 반환한다', async () => {
            await fix.httpClient
                .get('/users')
                .headers(adminAuth)
                .query({ wrong: 'value' })
                .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
        })
    })
})
