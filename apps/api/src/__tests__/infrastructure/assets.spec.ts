import { SchedulerRegistry } from '@nestjs/schedule'
import { Checksum, ensure, pickIds, S3ObjectService, sleep } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { HttpStatus, Logger } from '@nestjs/common'
import { type AssetDto, type AssetPresignedUploadDto, AssetsService } from '#infrastructure'
import {
    buildCreateAssetDto,
    buildFinalizeAssetDto,
    createAsset,
    downloadAsset,
    overrideConfigGetter,
    testAssets,
    uploadAndFinalizeAsset,
    uploadAsset,
    uploadFile,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { AppConfigService } from '#config'

describe('AssetsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let assetsService: AssetsService
    let scheduler: SchedulerRegistry
    const file = testAssets.small

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        assetsService = fix.module.get(AssetsService)
        scheduler = fix.module.get(SchedulerRegistry)
    })
    afterEach(() => teardown?.())

    describe('create', () => {
        it('업로드 요청을 반환한다', async () => {
            const createDto = buildCreateAssetDto(file)
            const uploadRequest = await assetsService.create(createDto)

            expect(uploadRequest).toEqual({
                assetId: expect.any(String),
                expiresAt: expect.any(Temporal.Instant),
                fields: expect.any(Object),
                method: 'POST',
                url: expect.any(String)
            })

            expect(uploadRequest.fields).toEqual(
                expect.objectContaining({
                    'Content-Type': createDto.mimeType,
                    key: uploadRequest.assetId
                })
            )
        })

        it('반환된 업로드 요청으로 파일을 업로드할 수 있다', async () => {
            const createDto = buildCreateAssetDto(file)
            const uploadRequest = await assetsService.create(createDto)

            const uploadRes = await uploadAsset(file.path, uploadRequest)
            expect(uploadRes.ok).toBe(true)
        })

        it('신고한 체크섬과 다른 본문은 스토리지가 업로드를 거부한다', async () => {
            const createDto = buildCreateAssetDto(file)
            const uploadRequest = await assetsService.create(createDto)

            // size 검증(content-length-range)에 걸리지 않도록 길이는 같고 내용만 다른 본문을 쓴다.
            const tampered = Buffer.alloc(createDto.size, 'x')
            const form = new FormData()
            Object.entries(uploadRequest.fields).forEach(([key, value]) => {
                form.append(key, value)
            })
            form.append('file', new Blob([tampered], { type: createDto.mimeType }), 'tampered')

            const uploadRes = await fetch(uploadRequest.url, { body: form, method: 'POST' })
            expect(uploadRes.ok).toBe(false)
        })

        describe('업로드 URL이 만료되었을 때', () => {
            let uploadRequest: AssetPresignedUploadDto

            beforeEach(async () => {
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 1 })

                const createDto = buildCreateAssetDto(file)
                uploadRequest = await assetsService.create(createDto)

                await sleep(1500)
            })

            it('업로드를 거부한다', async () => {
                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.ok).toBe(false)
            })
        })
    })

    describe('isUploadComplete', () => {
        it('업로드가 완료되었으면 true를 반환한다', async () => {
            const assetId = await uploadFile(fix, file)

            const isCompleted = await assetsService.isUploadComplete(assetId)
            expect(isCompleted).toBe(true)
        })

        it('업로드가 완료되지 않았으면 false를 반환한다', async () => {
            const asset = await createAsset(fix, file)

            const isCompleted = await assetsService.isUploadComplete(asset.assetId)
            expect(isCompleted).toBe(false)
        })
    })

    describe('finalizeUpload', () => {
        describe('업로드가 완료되었을 때', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })

            it('다운로드 정보를 반환하고 내려받은 파일은 원본 체크섬과 일치한다', async () => {
                const finalizeDto = buildFinalizeAssetDto()

                const asset = await assetsService.finalizeUpload(assetId, finalizeDto)

                expect(asset).toEqual(
                    expect.objectContaining({
                        ...finalizeDto,
                        download: {
                            expiresAt: expect.any(Temporal.Instant),
                            url: expect.any(String)
                        }
                    })
                )
                const buffer = await downloadAsset(asset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        describe('업로드가 만료되었을 때', () => {
            let assetId: string

            beforeEach(async () => {
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 1 })

                const createDto = buildCreateAssetDto(file)
                const createdAsset = await assetsService.create(createDto)
                assetId = createdAsset.assetId

                await sleep(1500)
            })

            it('404를 던지고 정리 cron이 찾을 DB 행을 남긴다', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                await expect(
                    assetsService.finalizeUpload(assetId, finalizeDto)
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
                await expect(assetsService.getMany([assetId])).resolves.toMatchObject([
                    { id: assetId, owner: null }
                ])
                await assetsService.cleanupExpiredUploads()
                await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })

        it('만료된 미완료 에셋의 S3 객체는 정리 cron이 삭제한다', async () => {
            const assetId = await uploadFile(fix, file)
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            await expect(
                assetsService.finalizeUpload(assetId, buildFinalizeAssetDto())
            ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            const s3Service = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3Service.isUploadComplete({ key: assetId })).resolves.toBe(true)
            await assetsService.cleanupExpiredUploads()
            await expect(s3Service.isUploadComplete({ key: assetId })).resolves.toBe(false)
            await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })

        it('이미 같은 소유자에게 완료한 에셋은 만료 후에도 재시도할 수 있다', async () => {
            const assetId = await uploadFile(fix, file)
            const finalizeDto = buildFinalizeAssetDto()
            await assetsService.finalizeUpload(assetId, finalizeDto)
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            await expect(assetsService.finalizeUpload(assetId, finalizeDto)).resolves.toMatchObject(
                { id: assetId, owner: finalizeDto.owner }
            )
            await assetsService.cleanupExpiredUploads()
            await expect(assetsService.isUploadComplete(assetId)).resolves.toBe(true)
        })

        it('다른 소유자의 완료 요청은 기존 소유권과 파일을 바꾸지 않는다', async () => {
            const assetId = await uploadFile(fix, file)
            const original = buildFinalizeAssetDto()
            await assetsService.finalizeUpload(assetId, original)
            const other = { owner: { ...original.owner, entityId: nullObjectId } }
            await expect(assetsService.finalizeUpload(assetId, other)).rejects.toMatchObject({
                status: HttpStatus.CONFLICT
            })
            await expect(assetsService.findOwner(assetId)).resolves.toEqual(original.owner)
            await expect(assetsService.isUploadComplete(assetId)).resolves.toBe(true)
        })

        it('없는 에셋의 완료 요청은 404를 반환한다', async () => {
            await expect(
                assetsService.finalizeUpload(nullObjectId, buildFinalizeAssetDto())
            ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
        })
    })

    describe('getMany', () => {
        describe('에셋이 존재할 때', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file)
                ])
            })

            it('에셋과 다운로드 정보를 반환하고 내려받은 파일은 원본 체크섬과 일치한다', async () => {
                const fetchedAssets = await assetsService.getMany(pickIds(assets))

                expect(fetchedAssets).toEqual(
                    expect.arrayContaining(
                        assets.map((asset) => ({
                            ...asset,
                            download: {
                                expiresAt: expect.any(Temporal.Instant),
                                url: expect.any(String)
                            }
                        }))
                    )
                )
                const buffer = await downloadAsset(ensure(fetchedAssets[0]))

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        it('에셋 ID 목록 중 하나라도 없으면 404를 던진다', async () => {
            await expect(assetsService.getMany([nullObjectId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })
    })

    describe('deleteMany', () => {
        describe('에셋이 존재할 때', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file)
                ])
            })

            it('반환값 없이 삭제하고 DB 조회와 다운로드는 404를 반환한다', async () => {
                await expect(assetsService.deleteMany(pickIds(assets))).resolves.toBeUndefined()

                for (const asset of assets) {
                    await expect(assetsService.getMany([asset.id])).rejects.toMatchObject({
                        status: HttpStatus.NOT_FOUND
                    })
                    const { download } = asset
                    if (null === download) throw new Error('download must have value')

                    const response = await fetch(download.url)
                    expect(response.status).toBe(404)
                }
            })
        })

        it('에셋 ID 목록에 없는 ID가 섞여 있어도 예외 없이 존재하는 에셋을 삭제한다', async () => {
            const asset = await uploadAndFinalizeAsset(fix, file)

            const mixedIds = [asset.id, nullObjectId]
            await expect(assetsService.deleteMany(mixedIds)).resolves.toBeUndefined()

            await expect(assetsService.getMany([asset.id])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })

        it('빈 배열을 넘기면 즉시 반환한다', async () => {
            await expect(assetsService.deleteMany([])).resolves.toBeUndefined()
        })

        it('S3 객체 일부를 삭제하지 못하면 경고를 남기고 첫 오류를 던진다', async () => {
            const asset = await uploadAndFinalizeAsset(fix, file)
            const s3Service = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            vi.spyOn(s3Service, 'deleteObject').mockRejectedValueOnce(new Error('s3 down'))

            const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

            await expect(assetsService.deleteMany([asset.id])).rejects.toThrow('s3 down')

            expect(warnSpy).toHaveBeenCalledWith(
                'partial S3 delete failure; DB rows retained for retry',
                expect.objectContaining({ failedCount: 1 })
            )
            await expect(assetsService.getMany([asset.id])).resolves.toHaveLength(1)
        })
    })

    describe('cleanupExpiredUploads', () => {
        let assetId: string

        beforeEach(async () => {
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 1 })
            expect(scheduler.doesExist('cron', 'assets.cleanupExpiredUploads')).toBe(true)

            const createDto = buildCreateAssetDto(file)
            const createdAsset = await assetsService.create(createDto)
            assetId = createdAsset.assetId
        })

        it('업로드가 만료되지 않은 에셋은 유지한다', async () => {
            await assetsService.cleanupExpiredUploads()

            await expect(assetsService.getMany([assetId])).resolves.toHaveLength(1)
        })

        it('업로드가 만료된 에셋은 제거한다', async () => {
            const config = fix.module.get(AppConfigService)
            await sleep(config.asset.uploadExpiresInSec * 1000 + 500)

            await assetsService.cleanupExpiredUploads()

            await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })

        it('업로드가 만료되어도 소유자가 부여된 에셋은 유지한다', async () => {
            // finalize가 만료 창 안에 끝나야 하므로 beforeEach의 1초 설정을 2초로 늘린다.
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 2 })
            const finalizedAsset = await uploadAndFinalizeAsset(fix, file)

            await sleep(2500)
            await assetsService.cleanupExpiredUploads()

            await expect(assetsService.getMany([finalizedAsset.id])).resolves.toHaveLength(1)
        })
    })
})
