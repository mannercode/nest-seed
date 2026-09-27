import type { MockInstance } from 'vitest'
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

        it('발급된 업로드 URL은 요청에 명시한 체크섬과 다른 파일을 거절한다', async () => {
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
        describe('S3에 업로드한 에셋이 존재하면', () => {
            let assetId: string
            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })
            it('업로드 완료 여부를 조회하면 true를 반환한다', async () => {
                const isCompleted = await assetsService.isUploadComplete(assetId)
                expect(isCompleted).toBe(true)
            })
        })

        describe('업로드 대기 중인 에셋이 존재하면', () => {
            let asset: AssetPresignedUploadDto
            beforeEach(async () => {
                asset = await createAsset(fix, file)
            })
            it('업로드 완료 여부를 조회하면 false를 반환한다', async () => {
                const isCompleted = await assetsService.isUploadComplete(asset.assetId)
                expect(isCompleted).toBe(false)
            })
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

            it('완료 처리에 404 예외를 던지고 남겨 둔 기록은 만료 정리로 삭제한다', async () => {
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

        describe('소유자가 확정된 에셋의 업로드 기한이 지났으면', () => {
            let assetId: string
            let finalizeDto: ReturnType<typeof buildFinalizeAssetDto>
            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
                finalizeDto = buildFinalizeAssetDto()
                await assetsService.finalizeUpload(assetId, finalizeDto)
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            })
            it('같은 소유자로 완료 처리를 재요청해도 소유권을 유지하고 만료 정리에서 파일을 보존한다', async () => {
                await expect(
                    assetsService.finalizeUpload(assetId, finalizeDto)
                ).resolves.toMatchObject({ id: assetId, owner: finalizeDto.owner })
                await assetsService.cleanupExpiredUploads()
                await expect(assetsService.isUploadComplete(assetId)).resolves.toBe(true)
            })
        })

        describe('소유자가 확정된 에셋이 존재하면', () => {
            let assetId: string
            let original: ReturnType<typeof buildFinalizeAssetDto>
            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
                original = buildFinalizeAssetDto()
                await assetsService.finalizeUpload(assetId, original)
            })
            it('다른 소유자로 완료 처리를 요청하면 409 예외를 던지고 기존 소유권과 파일을 유지한다', async () => {
                const other = { owner: { ...original.owner, entityId: nullObjectId } }
                await expect(assetsService.finalizeUpload(assetId, other)).rejects.toMatchObject({
                    status: HttpStatus.CONFLICT
                })
                await expect(assetsService.findOwner(assetId)).resolves.toEqual(original.owner)
                await expect(assetsService.isUploadComplete(assetId)).resolves.toBe(true)
            })
        })

        it('존재하지 않는 에셋의 업로드를 완료 처리하면 404 예외를 던진다', async () => {
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

        it('존재하지 않는 에셋 ID로 조회하면 404 예외를 던진다', async () => {
            await expect(assetsService.getMany([nullObjectId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })
    })

    describe('deleteMany', () => {
        describe('완료 처리된 에셋 세 개가 존재하면', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file)
                ])
            })

            it('에셋을 삭제하면 저장 기록과 다운로드 파일이 함께 사라진다', async () => {
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

            it('에셋 ID 목록에 없는 ID가 섞여 있어도 예외 없이 존재하는 에셋을 삭제한다', async () => {
                const asset = ensure(assets[0])

                const mixedIds = [asset.id, nullObjectId]
                await expect(assetsService.deleteMany(mixedIds)).resolves.toBeUndefined()

                await expect(assetsService.getMany([asset.id])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })

        it('빈 배열을 넘기면 오류 없이 반환한다', async () => {
            await expect(assetsService.deleteMany([])).resolves.toBeUndefined()
        })

        describe('에셋의 S3 객체를 삭제하는 중 오류가 발생하면', () => {
            let asset: AssetDto
            let warnSpy: MockInstance<Logger['warn']>
            beforeEach(async () => {
                asset = await uploadAndFinalizeAsset(fix, file)
                const s3Service = fix.module.get<S3ObjectService>(S3ObjectService.getName())
                vi.spyOn(s3Service, 'deleteObject').mockRejectedValueOnce(new Error('s3 down'))

                warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
            })
            it('경고를 기록하고 S3 오류를 던지며 DB 기록을 유지한다', async () => {
                await expect(assetsService.deleteMany([asset.id])).rejects.toThrow('s3 down')

                expect(warnSpy).toHaveBeenCalledWith(
                    'partial S3 delete failure; DB rows retained for retry',
                    expect.objectContaining({ failedCount: 1 })
                )
                await expect(assetsService.getMany([asset.id])).resolves.toHaveLength(1)
            })
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

        describe('미완료 에셋의 업로드 기한이 지났으면', () => {
            beforeEach(async () => {
                const config = fix.module.get(AppConfigService)
                await sleep(config.asset.uploadExpiresInSec * 1000 + 500)
            })
            it('만료 정리로 에셋을 삭제한다', async () => {
                await assetsService.cleanupExpiredUploads()

                await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })

        describe('소유자가 확정된 에셋의 업로드 기한이 지났으면', () => {
            let finalizedAsset: AssetDto
            beforeEach(async () => {
                // finalize가 만료 창 안에 끝나야 하므로 beforeEach의 1초 설정을 2초로 늘린다.
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 2 })
                finalizedAsset = await uploadAndFinalizeAsset(fix, file)

                await sleep(2500)
            })
            it('만료 정리를 실행해도 에셋을 유지한다', async () => {
                await assetsService.cleanupExpiredUploads()

                await expect(assetsService.getMany([finalizedAsset.id])).resolves.toHaveLength(1)
            })
        })

        describe('S3 업로드 후 완료 처리 전에 기한이 지난 에셋이 존재하면', () => {
            let assetId: string
            let s3Service: S3ObjectService
            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
                await expect(
                    assetsService.finalizeUpload(assetId, buildFinalizeAssetDto())
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
                s3Service = fix.module.get<S3ObjectService>(S3ObjectService.getName())
                await expect(s3Service.isUploadComplete({ key: assetId })).resolves.toBe(true)
            })
            it('만료 정리로 S3 객체와 DB 기록을 모두 삭제한다', async () => {
                await assetsService.cleanupExpiredUploads()
                await expect(s3Service.isUploadComplete({ key: assetId })).resolves.toBe(false)
                await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })
})
