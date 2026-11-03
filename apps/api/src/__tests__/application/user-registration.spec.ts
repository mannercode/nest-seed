import { DateUtil, objectId, S3ObjectService } from '@mannercode/common'
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
    describe.each([
        { condition: '이미지가 아닌 형식', metadata: { mimeType: 'text/plain' } },
        { condition: '5 MiB보다 큰 파일', metadata: { size: 5 * 1024 * 1024 + 1 } }
    ])('$condition을 요청하면', ({ metadata }) => {
        it('업로드 요청을 거절하고 자산 기록을 만들지 않는다', async () => {
            await fix.httpClient
                .post('/users/photo-upload')
                .body({ ...buildCreateAssetDto(), mimeType: 'image/png', ...metadata })
                .badRequest()
            expect(await fix.module.get(AssetsRepository).collection.countDocuments()).toBe(0)
        })
    })
    describe('삭제를 요청했지만 파일 삭제에 실패한 사진이면', () => {
        let assetId: string
        beforeEach(async () => {
            assetId = (
                await fix.module
                    .get(UserRegistrationService)
                    .createPhotoUpload({ ...buildCreateAssetDto(), mimeType: 'image/png' })
            ).assetId
            await fix.module.get(AssetsRepository).requestDeletion([assetId])
        })
        it('가입을 거절하고 계정을 만들지 않는다', async () => {
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
                .unprocessableEntity()
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
        beforeEach(async () => {
            const upload = await fix.module
                .get(UserRegistrationService)
                .createPhotoUpload({ ...buildCreateAssetDto(), mimeType: 'image/png' as const })
            expect((await uploadAsset(testAssets.image.path, upload)).ok).toBe(true)
            assetId = upload.assetId
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
        describe('사진 소유권 저장에 실패하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.module.get(AssetsRepository), 'assignOwner').mockRejectedValueOnce(
                    new Error('write failed')
                )
            })
            it('가입 오류를 반환하고 계정 생성과 소유권 변경을 롤백한다', async () => {
                await fix.httpClient
                    .post('/users')
                    .body({ ...buildCreateUserDto(), photoAssetId: assetId })
                    .internalServerError()
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
                await fix.module
                    .get(AssetsRepository)
                    .collection.updateOne(
                        { _id: objectId(assetId) },
                        { $set: { createdAt: DateUtil.toDate(DateUtil.add({ hours: -2 })) } }
                    )
            })
            it('가입을 거절하고 계정을 만들지 않는다', async () => {
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
                        .isUploadComplete({ key: assetId })
                ).toBe(false)
            })
        })
    })
    it('정리 작업을 실행하면 만료된 임시 사진을 제거한다', async () => {
        const registration = fix.module.get(UserRegistrationService)
        const upload = await registration.createPhotoUpload({
            ...buildCreateAssetDto(),
            mimeType: 'image/png' as const
        })
        await fix.module
            .get(AssetsRepository)
            .collection.updateOne(
                { _id: objectId(upload.assetId) },
                { $set: { createdAt: DateUtil.toDate(DateUtil.add({ hours: -2 })) } }
            )
        await registration.cleanupExpiredPhotos()
        expect(await fix.module.get(AssetsService).findOwner(upload.assetId)).toBeUndefined()
    })
})
