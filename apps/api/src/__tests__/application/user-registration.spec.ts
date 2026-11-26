import { ensure, S3ObjectService } from '@mannercode/common'
import { UserRegistrationService } from '#application'
import { UserSchema, UsersRepository, UsersService } from '#core'
import { AssetsService, AssetPresignedUploadSchema } from '#infrastructure'
import { AssetsRepository } from '../../services/infrastructure/assets/assets.repository.js'
import {
    buildCreateUserDto,
    buildCreateAssetDto,
    createAppTestContext,
    loginUser,
    uploadAsset,
    testAssets,
    overrideConfigGetter,
    type AppTestContext
} from '../helpers/index.js'

describe('UserRegistrationService', () => {
    let fix: AppTestContext
    beforeEach(async () => {
        fix = await createAppTestContext()
    })
    afterEach(() => fix?.teardown())
    it('사진 업로드 요청은 업로드 조건을 반환하며 계정을 생성하지 않는다', async () => {
        const { body } = await fix.httpClient
            .post('/users/photo-upload')
            .body({ ...buildCreateAssetDto(), mimeType: 'image/png' as const })
            .created({ schema: AssetPresignedUploadSchema })
        expect(body).toMatchObject({
            method: 'POST',
            assetId: expect.any(String),
            url: expect.any(String)
        })
        expect(await fix.module.get(UsersRepository).collection.countDocuments()).toBe(0)
    })
    it.each([
        { file: '이미지가 아닌 파일의', metadata: { mimeType: 'text/plain' } },
        { file: '5 MiB보다 큰 파일의', metadata: { size: 5 * 1024 * 1024 + 1 } }
    ])(
        '$file 업로드 URL을 요청하면 400을 반환하고 자산 기록을 만들지 않는다',
        async ({ metadata }) => {
            await fix.httpClient
                .post('/users/photo-upload')
                .body({ ...buildCreateAssetDto(), mimeType: 'image/png', ...metadata })
                .badRequest()
            expect(await fix.module.get(AssetsRepository).collection.countDocuments()).toBe(0)
        }
    )
    describe('사진에 삭제 요청이 기록돼 있으면', () => {
        let assetId: string
        beforeEach(async () => {
            assetId = (
                await fix.module
                    .get(UserRegistrationService)
                    .createPhotoUpload({ ...buildCreateAssetDto(), mimeType: 'image/png' })
            ).assetId
            await fix.module.get(AssetsRepository).requestDeletion([assetId])
        })
        it('그 사진으로 가입을 요청하면 404를 반환하고 계정을 만들지 않는다', async () => {
            await fix.httpClient
                .post('/users')
                .body({ ...buildCreateUserDto(), photoAssetId: assetId })
                .notFound()
            expect(await fix.module.get(UsersRepository).collection.countDocuments()).toBe(0)
        })
    })
    describe('사진을 첨부하지 않았으면', () => {
        it('가입 후 사진 없이 로그인할 수 있다', async () => {
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
    describe('사진 업로드 요청만 만들었으면', () => {
        let assetId: string
        beforeEach(async () => {
            assetId = (
                await fix.module
                    .get(UserRegistrationService)
                    .createPhotoUpload({ ...buildCreateAssetDto(), mimeType: 'image/png' as const })
            ).assetId
        })
        it('가입하면 422를 반환하고 계정을 생성하지 않는다', async () => {
            await fix.httpClient
                .post('/users')
                .body({ ...buildCreateUserDto(), photoAssetId: assetId })
                .unprocessableEntity({
                    expected: {
                        code: 'ERR_REGISTRATION_PHOTO_INCOMPLETE',
                        message: 'Photo upload is not complete.',
                        assetId
                    }
                })
            expect(
                await fix.module
                    .get(UsersRepository)
                    .findForAuthentication({ email: 'name@mail.com' })
            ).toBeNull()
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeNull()
        })
    })
    describe('사진 전송을 마쳤으면', () => {
        let assetId: string
        let photoKey: string
        beforeEach(async () => {
            const upload = await fix.module
                .get(UserRegistrationService)
                .createPhotoUpload({ ...buildCreateAssetDto(), mimeType: 'image/png' as const })
            expect((await uploadAsset(testAssets.image.path, upload)).ok).toBe(true)
            assetId = upload.assetId
            photoKey = ensure(upload.fields.key)
        })
        it('가입하면 계정과 사진 소유권을 함께 저장한다', async () => {
            const { body } = await fix.httpClient
                .post('/users')
                .body({ ...buildCreateUserDto(), photoAssetId: assetId })
                .created({ schema: UserSchema })
            expect(body.photoAssetId).toBe(assetId)
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toEqual({
                service: 'users',
                entityId: body.id
            })
            const downloads = vi.spyOn(fix.module.get(AssetsService), 'getMany')
            expect(await fix.module.get(UsersService).getMany([body.id])).toEqual([body])
            expect(downloads).not.toHaveBeenCalled()
        })
        it('같은 사진으로 동시에 가입하면 한 계정만 사진을 소유한다', async () => {
            const results = await Promise.all(
                ['first@mail.com', 'second@mail.com'].map((email) =>
                    fix.httpClient
                        .post('/users')
                        .body({ ...buildCreateUserDto({ email }), photoAssetId: assetId })
                        .sendRaw()
                )
            )
            expect(results.map((result) => result.status).sort()).toEqual([201, 409])
            const created = results.find((result) => result.status === 201)!.body
            expect(await fix.module.get(UsersRepository).collection.countDocuments()).toBe(1)
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toEqual({
                service: 'users',
                entityId: created.id
            })
        })
        describe('사진 소유권을 쓴 뒤 다운로드 URL 발급이 실패하면', () => {
            beforeEach(() => {
                vi.spyOn(
                    fix.module.get<S3ObjectService>(S3ObjectService.getName()),
                    'presignDownload'
                ).mockRejectedValueOnce(new Error('signing failed'))
            })
            it('가입 요청에 500을 반환하고 계정 생성과 소유권 변경을 모두 되돌린다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...buildCreateUserDto(), photoAssetId: assetId })
                    .internalServerError()
                expect(
                    fix.module.get<S3ObjectService>(S3ObjectService.getName()).presignDownload
                ).toHaveBeenCalledOnce()
                expect(
                    await fix.module
                        .get(UsersRepository)
                        .findForAuthentication({ email: 'name@mail.com' })
                ).toBeNull()
                expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeNull()
                await fix.httpClient
                    .post('/users')
                    .body({ ...buildCreateUserDto(), photoAssetId: assetId })
                    .created({ schema: UserSchema })
            })
        })
        describe('이미 다른 계정이 사진을 사용하고 있으면', () => {
            beforeEach(async () => {
                await fix.module
                    .get(UserRegistrationService)
                    .register({
                        ...buildCreateUserDto({ email: 'first@mail.com' }),
                        photoAssetId: assetId
                    })
            })
            it('가입을 거절하고 두 번째 계정을 만들지 않는다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...buildCreateUserDto(), photoAssetId: assetId })
                    .conflict()
                expect(
                    await fix.module
                        .get(UsersRepository)
                        .findForAuthentication({ email: 'name@mail.com' })
                ).toBeNull()
            })
        })
        describe('업로드 유효기간이 지났으면', () => {
            beforeEach(async () => {
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            })
            it('그 사진으로 가입을 요청하면 404를 반환하고 계정을 만들지 않는다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...buildCreateUserDto(), photoAssetId: assetId })
                    .notFound()
                expect(
                    await fix.module
                        .get(UsersRepository)
                        .findForAuthentication({ email: 'name@mail.com' })
                ).toBeNull()
            })
        })
        describe('사진을 첨부해 가입하고 로그인했으면', () => {
            let userId: string
            let headers: { Authorization: string }
            beforeEach(async () => {
                const input = buildCreateUserDto()
                userId = (
                    await fix.module
                        .get(UserRegistrationService)
                        .register({ ...input, photoAssetId: assetId })
                ).id
                const session = await loginUser(fix, {
                    email: input.email,
                    password: input.password
                })
                headers = { Authorization: 'Bearer ' + session.accessToken }
            })
            it('탈퇴하면 계정과 사진 파일을 삭제한다', async () => {
                await fix.httpClient.delete('/users/me').headers(headers).noContent()
                await expect(fix.module.get(UsersService).getMany([userId])).rejects.toMatchObject({
                    status: 404
                })
                expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeUndefined()
                expect(
                    await fix.module
                        .get<S3ObjectService>(S3ObjectService.getName())
                        .isUploadComplete({ key: photoKey })
                ).toBe(false)
            })
        })
    })
    describe('소유자가 없는 임시 사진의 업로드 기한이 지났으면', () => {
        let assetId: string
        beforeEach(async () => {
            const upload = await fix.module
                .get(UserRegistrationService)
                .createPhotoUpload({ ...buildCreateAssetDto(), mimeType: 'image/png' })
            assetId = upload.assetId
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
        })
        it('정리 작업을 실행하면 만료된 임시 사진을 제거한다', async () => {
            await fix.module.get(UserRegistrationService).cleanupExpiredPhotos()
            expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeUndefined()
        })
    })
})
