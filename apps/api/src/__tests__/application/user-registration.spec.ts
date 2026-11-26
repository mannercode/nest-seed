import { ensure, MongoConnection, S3ObjectService } from '@mannercode/common'
import { UserRegistrationService } from '#application'
import { type CreateUserDto, UserSchema } from '#core'
import { AssetsService } from '#infrastructure'
import {
    buildCreateUserDto,
    buildCreateAssetDto,
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
    const users = () => fix.module.get(MongoConnection).db.collection('users')
    const assetCount = () =>
        fix.module.get(MongoConnection).db.collection('assets').countDocuments()
    beforeEach(async () => {
        fix = await createAppTestContext()
        applicant = buildCreateUserDto()
    })
    afterEach(() => fix?.teardown())
    it('사진 업로드 조건을 발급해도 계정은 생성하지 않는다', async () => {
        const usersBefore = await users().countDocuments()
        const assetsBefore = await assetCount()
        const body = await requestRegistrationPhotoUpload(fix)
        expect(body).toMatchObject({
            method: 'POST',
            assetId: expect.any(String),
            url: expect.any(String)
        })
        await expect(fix.module.get(AssetsService).findOwner(body.assetId)).resolves.toBeNull()
        expect(await assetCount()).toBe(assetsBefore + 1)
        expect(await users().countDocuments()).toBe(usersBefore)
    })
    it.each([
        { file: '이미지가 아닌 파일의', metadata: { mimeType: 'text/plain' } },
        { file: '5 MiB보다 큰 파일의', metadata: { size: 5 * 1024 * 1024 + 1 } }
    ])(
        '$file 업로드 URL을 요청하면 400을 반환하고 자산 기록을 만들지 않는다',
        async ({ metadata }) => {
            const assetsBefore = await assetCount()
            await fix.httpClient
                .post('/users/photo-upload')
                .body({ ...buildCreateAssetDto(), mimeType: 'image/png', ...metadata })
                .badRequest()
            expect(await assetCount()).toBe(assetsBefore)
        }
    )
    describe('파일 삭제에 실패한 사진으로 가입하면', () => {
        let assetId: string
        beforeEach(async () => {
            const upload = await requestRegistrationPhotoUpload(fix)
            expect((await uploadAsset(testAssets.image.path, upload)).ok).toBe(true)
            assetId = upload.assetId
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            const failure = new Error('photo delete failed')
            vi.spyOn(storage, 'deleteObject').mockRejectedValueOnce(failure)
            await expect(fix.module.get(AssetsService).deleteMany([assetId])).rejects.toBe(failure)
            await expect(
                storage.isUploadComplete({ key: ensure(upload.fields.key) })
            ).resolves.toBe(true)
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
        let photoKey: string
        beforeEach(async () => {
            const upload = await requestRegistrationPhotoUpload(fix)
            expect((await uploadAsset(testAssets.image.path, upload)).ok).toBe(true)
            assetId = upload.assetId
            photoKey = ensure(upload.fields.key)
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
            expect(await users().countDocuments()).toBe(1)
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
        describe('사진 소유권 등록 후 다운로드 URL 발급에 실패하면', () => {
            beforeEach(() => {
                vi.spyOn(
                    fix.module.get<S3ObjectService>(S3ObjectService.getName()),
                    'presignDownload'
                ).mockRejectedValueOnce(new Error('signing failed'))
            })
            it('500을 반환하고 계정과 사진 소유권을 함께 롤백한다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...applicant, photoAssetId: assetId })
                    .internalServerError()
                expect(await users().countDocuments()).toBe(0)
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
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
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
                expect(await users().countDocuments({ deletedAt: null })).toBe(2)
                await fix.httpClient.delete('/users/me').headers(headers).noContent()
                expect(await users().countDocuments({ deletedAt: null })).toBe(1)
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
                expect(
                    await fix.module
                        .get<S3ObjectService>(S3ObjectService.getName())
                        .isUploadComplete({ key: photoKey })
                ).toBe(false)
            })
        })
    })
    describe('만료된 임시 사진을 정리하면', () => {
        let assetId: string
        beforeEach(async () => {
            const upload = await requestRegistrationPhotoUpload(fix)
            assetId = upload.assetId
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
        })
        it('소유자 없는 사진을 삭제한다', async () => {
            await fix.module.get(UserRegistrationService).cleanupExpiredPhotos()
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeUndefined()
        })
    })
})
