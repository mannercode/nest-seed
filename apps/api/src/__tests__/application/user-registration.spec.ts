import { DateUtil, ensure, S3ObjectService } from '@mannercode/common'
import { ClientSession } from 'mongodb'
import { UserRegistrationService } from '#application'
import { type CreateUserDto, UserSchema } from '#core'
import { AssetsService } from '#infrastructure'
import { WebHomeViewSchema } from '#view'
import {
    buildCreateUserDto,
    advancePastUploadDeadline,
    requestRegistrationPhotoUpload,
    createAppTestContext,
    loginUser,
    uploadAsset,
    testAssets,
    overrideConfigGetter,
    type AppTestContext
} from '#test-helpers'

describe('UserRegistrationService', () => {
    let fix: AppTestContext
    let applicant: CreateUserDto
    beforeEach(async () => {
        fix = await createAppTestContext()
        applicant = buildCreateUserDto()
    })
    afterEach(() => fix?.teardown())
    describe.each([
        {
            earlier: 'S3 정책',
            signedAt: '2026-01-01T12:00:00.900Z',
            expiresAt: '2026-01-01T12:01:00Z'
        },
        {
            earlier: '사진 소유권 확정',
            signedAt: '2026-01-01T12:00:01.100Z',
            expiresAt: '2026-01-01T12:01:00.750Z'
        }
    ])('$earlier 기한이 먼저 끝나면', ({ signedAt, expiresAt }) => {
        beforeEach(async () => {
            vi.spyOn(DateUtil, 'now').mockReturnValue(
                Temporal.Instant.from('2026-01-01T12:00:00.750Z')
            )
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 60 })
        })
        it('사진 업로드 요청에 그 기한을 반환한다', async () => {
            using signingClock = vi.spyOn(Date, 'now')
            signingClock.mockReturnValue(Date.parse(signedAt))
            const upload = await requestRegistrationPhotoUpload(fix)
            expect(upload.expiresAt.epochMilliseconds).toBe(Date.parse(expiresAt))
        })
    })
    describe('파일 삭제에 실패한 사진으로 가입하면', () => {
        let assetId: string
        beforeEach(async () => {
            const upload = await requestRegistrationPhotoUpload(fix)
            expect((await uploadAsset(testAssets.image.path, upload)).ok).toBe(true)
            assetId = upload.assetId
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            const assets = fix.module.get(AssetsService)
            const { download } = ensure((await assets.getMany([assetId]))[0])
            const failure = new Error('photo delete failed')
            vi.spyOn(storage, 'deleteObject').mockRejectedValueOnce(failure)
            await expect(assets.deleteMany([assetId])).rejects.toBe(failure)
            expect((await fetch(download.url)).status).toBe(200)
        })
        it('404를 반환하고 계정을 만들지 않는다', async () => {
            await fix.httpClient
                .post('/users')
                .body({ ...applicant, photoAssetId: assetId })
                .notFound()
            await fix.httpClient.post('/users').body(applicant).created({ schema: UserSchema })
        })
    })
    describe('사진을 첨부하지 않고 가입하면', () => {
        it('사진 ID는 null이고 로그인할 수 있다', async () => {
            const input = buildCreateUserDto()
            const { body } = await fix.httpClient
                .post('/users')
                .body(input)
                .created({ schema: UserSchema })
            expect(body.photoAssetId).toBeNull()
            await fix.httpClient
                .post('/users/login')
                .body({ email: input.email, password: input.password })
                .ok()
        })
    })
    describe('전송하지 않은 사진으로 가입하면', () => {
        let assetId: string
        beforeEach(async () => {
            assetId = (await requestRegistrationPhotoUpload(fix)).assetId
        })
        it('422를 반환하고 계정을 만들지 않는다', async () => {
            await fix.httpClient
                .post('/users')
                .body({ ...applicant, photoAssetId: assetId })
                .unprocessableEntity({
                    expected: {
                        code: 'ERR_REGISTRATION_PHOTO_INCOMPLETE',
                        message: 'Photo upload is not complete.',
                        assetId
                    }
                })
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeNull()
            await fix.httpClient.post('/users').body(applicant).created({ schema: UserSchema })
        })
    })
    describe('업로드한 사진', () => {
        let assetId: string
        beforeEach(async () => {
            const upload = await requestRegistrationPhotoUpload(fix)
            expect((await uploadAsset(testAssets.image.path, upload)).ok).toBe(true)
            assetId = upload.assetId
        })
        describe('발급 후 새 업로드의 유효기간을 줄이면', () => {
            beforeEach(async () => {
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 1 })
                vi.spyOn(DateUtil, 'now').mockReturnValue(DateUtil.add({ seconds: 2 }))
                await fix.module.get(AssetsService).cleanupExpiredUploads()
            })
            it('기존 사진으로 가입할 수 있다', async () => {
                const { body } = await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId })
                    .created({ schema: UserSchema })
                expect(body.photoAssetId).toBe(assetId)
            })
        })
        it('가입하면 계정과 사진 소유권을 함께 저장한다', async () => {
            const { body } = await fix.httpClient
                .post('/users')
                .body({ ...applicant, photoAssetId: assetId })
                .created({ schema: UserSchema })
            expect(body.photoAssetId).toBe(assetId)
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toEqual({
                service: 'users',
                entityId: body.id
            })
            const { user } = await loginUser(fix, {
                email: applicant.email,
                password: applicant.password
            })
            expect(user).toEqual(body)
        })
        describe('대문자 사진 ID로 가입한 회원이 탈퇴하면', () => {
            let headers: { Authorization: string }
            let photoUrl: string
            beforeEach(async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId.toUpperCase() })
                    .created({ schema: UserSchema })
                const { accessToken } = await loginUser(fix, {
                    email: applicant.email,
                    password: applicant.password
                })
                headers = { Authorization: 'Bearer ' + accessToken }
                const { body } = await fix.httpClient
                    .get('/views/web/home')
                    .headers(headers)
                    .ok({ schema: WebHomeViewSchema })
                photoUrl = ensure(body.photoUrl)
                expect((await fetch(photoUrl)).status).toBe(200)
            })
            it('업로드한 사진을 삭제한다', async () => {
                await fix.httpClient.delete('/users/me').headers(headers).noContent()
                expect((await fetch(photoUrl)).status).toBe(404)
            })
        })
        it('같은 사진으로 동시에 가입하면 한 계정만 사진을 소유한다', async () => {
            const applicants = ['first@mail.com', 'second@mail.com'].map((email) =>
                buildCreateUserDto({ email })
            )
            const results = await Promise.all(
                applicants.map((input) =>
                    fix.httpClient
                        .post('/users')
                        .body({ ...input, photoAssetId: assetId })
                        .sendRaw()
                )
            )
            expect(results.map((result) => result.status).sort()).toEqual([201, 409])
            const created = UserSchema.parse(
                ensure(results.find((result) => result.status === 201)).body
            )
            const winner = ensure(applicants.find(({ email }) => email === created.email))
            const { user } = await loginUser(fix, {
                email: winner.email,
                password: winner.password
            })
            expect(user).toEqual(created)
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toEqual({
                service: 'users',
                entityId: created.id
            })
            const other = ensure(applicants[results.findIndex((result) => result.status === 409)])
            await fix.httpClient.post('/users').body(other).created({ schema: UserSchema })
        })
        describe('다운로드 URL 발급이 실패하면', () => {
            beforeEach(() => {
                vi.spyOn(
                    fix.module.get<S3ObjectService>(S3ObjectService.getName()),
                    'presignDownload'
                ).mockRejectedValueOnce(new Error('signing failed'))
            })
            it('사진을 첨부해 가입할 수 있고 홈 조회는 500을 반환한다', async () => {
                const { body: user } = await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId })
                    .created({ schema: UserSchema })
                expect(await fix.module.get(AssetsService).findOwner(assetId)).toEqual({
                    service: 'users',
                    entityId: user.id
                })
                const { accessToken } = await loginUser(fix, {
                    email: applicant.email,
                    password: applicant.password
                })
                await fix.httpClient
                    .get('/views/web/home')
                    .headers({ Authorization: 'Bearer ' + accessToken })
                    .internalServerError()
            })
        })
        describe('가입 트랜잭션을 커밋할 수 없으면', () => {
            beforeEach(() => {
                vi.spyOn(ClientSession.prototype, 'commitTransaction').mockRejectedValueOnce(
                    new Error('commit failed')
                )
            })
            it('500을 반환하고 계정과 사진 소유권을 함께 롤백한다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId })
                    .internalServerError()
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: applicant.email, password: applicant.password })
                    .unauthorized()
                expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeNull()
                await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId })
                    .created({ schema: UserSchema })
            })
        })
        describe('다른 계정이 사용 중인 사진으로 가입하면', () => {
            beforeEach(async () => {
                await fix.httpClient
                    .post('/users')
                    .body({
                        ...buildCreateUserDto({ email: 'first@mail.com' }),
                        photoAssetId: assetId
                    })
                    .created({ schema: UserSchema })
            })
            it('409를 반환하고 새 계정을 만들지 않는다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId })
                    .conflict()
                await fix.httpClient.post('/users').body(applicant).created({ schema: UserSchema })
            })
        })
        describe('기한이 지난 사진으로 가입하면', () => {
            beforeEach(async () => {
                advancePastUploadDeadline(fix)
            })
            it('404를 반환하고 계정을 만들지 않는다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId })
                    .notFound()
                await fix.httpClient.post('/users').body(applicant).created({ schema: UserSchema })
            })
        })
        describe('사진을 첨부해 가입하고 로그인한 뒤', () => {
            let headers: { Authorization: string }
            let otherHeaders: { Authorization: string }
            beforeEach(async () => {
                const other = buildCreateUserDto({ email: 'other@mail.com' })
                await fix.httpClient.post('/users').body(other).created({ schema: UserSchema })
                otherHeaders = {
                    Authorization:
                        'Bearer ' +
                        (await loginUser(fix, { email: other.email, password: other.password }))
                            .accessToken
                }
                await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId })
                    .created({ schema: UserSchema })
                const session = await loginUser(fix, {
                    email: applicant.email,
                    password: applicant.password
                })
                headers = { Authorization: 'Bearer ' + session.accessToken }
            })
            describe('가입 사진이 삭제되면', () => {
                beforeEach(async () => {
                    await fix.module.get(AssetsService).deleteMany([assetId])
                })
                it('본인 정보를 조회하면 200과 가입 당시의 사진 ID를 반환한다', async () => {
                    const { body } = await fix.httpClient
                        .get('/users/me')
                        .headers(headers)
                        .ok({ schema: UserSchema })
                    expect(body).toMatchObject({ email: applicant.email, photoAssetId: assetId })
                })
            })
            it('탈퇴하면 본인 계정과 사진만 삭제하고 다른 사용자는 계속 본인 정보를 조회할 수 있다', async () => {
                const { body: home } = await fix.httpClient
                    .get('/views/web/home')
                    .headers(headers)
                    .ok({ schema: WebHomeViewSchema })
                const photoUrl = ensure(home.photoUrl)
                expect((await fetch(photoUrl)).status).toBe(200)
                await fix.httpClient.delete('/users/me').headers(headers).noContent()
                await fix.httpClient
                    .post('/users/login')
                    .body({ email: applicant.email, password: applicant.password })
                    .unauthorized()
                await fix.httpClient.get('/users/me').headers(headers).notFound()
                const { body: other } = await fix.httpClient
                    .get('/users/me')
                    .headers(otherHeaders)
                    .ok({ schema: UserSchema })
                expect(other.email).toBe('other@mail.com')
                expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeUndefined()
                expect((await fetch(photoUrl)).status).toBe(404)
            })
        })
    })
    describe('만료된 임시 사진을 정리하면', () => {
        let assetId: string
        beforeEach(async () => {
            const upload = await requestRegistrationPhotoUpload(fix)
            assetId = upload.assetId
            advancePastUploadDeadline(fix)
        })
        it('소유자 없는 사진을 삭제한다', async () => {
            await fix.module.get(UserRegistrationService).cleanupExpiredPhotos()
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeUndefined()
        })
    })
})
