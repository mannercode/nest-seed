import type { SchedulerRegistry } from '@nestjs/schedule'
import type { AssetDto, AssetPresignedUploadDto, AssetsService } from 'infrastructure'
import { Checksum, ensure, pickIds, S3ObjectService, sleep } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
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
    type AppTestContext
} from '../helpers'

describe('AssetsService', () => {
    let fix: AppTestContext
    let assetsService: AssetsService
    let scheduler: SchedulerRegistry
    const file = testAssets.small

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { AssetsService } = await import('infrastructure')
        const { SchedulerRegistry } = await import('@nestjs/schedule')
        fix = await createAppTestContext()
        assetsService = fix.module.get(AssetsService)
        scheduler = fix.module.get(SchedulerRegistry)
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        it('업로드 요청을 반환한다', async () => {
            const createDto = buildCreateAssetDto(file)
            const uploadRequest = await assetsService.create(createDto)

            expect(uploadRequest).toEqual({
                assetId: expect.any(String),
                expiresAt: expect.any(Date),
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

            it('다운로드 정보가 포함된 에셋을 반환한다', async () => {
                const finalizeDto = buildFinalizeAssetDto()

                const asset = await assetsService.finalizeUpload(assetId, finalizeDto)

                expect(asset).toEqual(
                    expect.objectContaining({
                        ...finalizeDto,
                        download: { expiresAt: expect.any(Date), url: expect.any(String) }
                    })
                )
            })

            it('반환된 다운로드 URL로 받은 파일이 원본과 체크섬이 일치한다', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                const asset = await assetsService.finalizeUpload(assetId, finalizeDto)

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

            it('완료 처리 시 404를 던진다', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                await expect(
                    assetsService.finalizeUpload(assetId, finalizeDto)
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            })

            it('완료 처리 실패 후에는 에셋이 조회되지 않는다', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                await expect(assetsService.finalizeUpload(assetId, finalizeDto)).rejects.toThrow()

                await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })

        it('업로드까지 마친 에셋이 만료되어 완료 처리에 실패하면 S3 객체도 함께 삭제한다', async () => {
            // 업로드는 만료 창 안에, 완료 처리는 만료 후에 일어나도록 창을 2초로 잡는다.
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 2 })
            const assetId = await uploadFile(fix, file)
            await sleep(2500)

            await expect(
                assetsService.finalizeUpload(assetId, buildFinalizeAssetDto())
            ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })

            // DB 행이 사라지면 정리 cron이 다시 찾지 못하므로 S3 객체는 이 시점에 지워져 있어야 한다.
            const s3Service = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3Service.isUploadComplete({ key: assetId })).resolves.toBe(false)
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

            it('에셋 ID 목록에 해당하는 에셋과 다운로드 정보를 반환한다', async () => {
                const fetchedAssets = await assetsService.getMany(pickIds(assets))

                expect(fetchedAssets).toEqual(
                    expect.arrayContaining(
                        assets.map((asset) => ({
                            ...asset,
                            download: { expiresAt: expect.any(Date), url: expect.any(String) }
                        }))
                    )
                )
            })

            it('반환된 다운로드 URL로 받은 파일이 원본과 체크섬이 일치한다', async () => {
                const fetchedAssets = await assetsService.getMany([ensure(assets[0]).id])
                const fetchedAsset = ensure(fetchedAssets[0])

                const buffer = await downloadAsset(fetchedAsset)

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

            it('성공 시 반환값이 없다', async () => {
                await expect(assetsService.deleteMany(pickIds(assets))).resolves.toBeUndefined()
            })

            it('삭제 후에는 조회 시 404를 던진다', async () => {
                await assetsService.deleteMany([ensure(assets[0]).id])

                await expect(assetsService.getMany([ensure(assets[0]).id])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })

            it('삭제하면 다운로드 URL이 무효화된다', async () => {
                await assetsService.deleteMany([ensure(assets[0]).id])

                const { download } = ensure(assets[0])
                if (null === download) throw new Error('download must have value')

                const response = await fetch(download.url)
                expect(response.status).toBe(404)
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
            jest.spyOn(s3Service, 'deleteObject').mockRejectedValueOnce(new Error('s3 down'))

            const { Logger } = await import('@nestjs/common')
            const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()

            await expect(assetsService.deleteMany([asset.id])).rejects.toThrow('s3 down')

            expect(warnSpy).toHaveBeenCalledWith(
                'partial S3 delete failure; DB rows retained for retry',
                expect.objectContaining({ failedCount: 1 })
            )
            await expect(assetsService.getMany([asset.id])).resolves.toHaveLength(1)
        })
    })

    describe('cleanupExpiredUploads', () => {
        let fireOnTick: () => Promise<void>
        let assetId: string

        beforeEach(async () => {
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 1 })
            const cronJob = scheduler.getCronJob('assets.cleanupExpiredUploads')
            fireOnTick = cronJob.fireOnTick

            const createDto = buildCreateAssetDto(file)
            const createdAsset = await assetsService.create(createDto)
            assetId = createdAsset.assetId
        })

        it('업로드가 만료되지 않은 에셋은 유지한다', async () => {
            await fireOnTick()
            await sleep(1000)

            await expect(assetsService.getMany([assetId])).resolves.toHaveLength(1)
        })

        it('업로드가 만료된 에셋은 제거한다', async () => {
            const { AppConfigService } = await import('config')
            const config = fix.module.get(AppConfigService)
            await sleep(config.asset.uploadExpiresInSec * 1000 + 500)

            await fireOnTick()
            await sleep(1000)

            await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })

        it('업로드가 만료되어도 소유자가 부여된 에셋은 유지한다', async () => {
            // finalize가 만료 창 안에 끝나야 하므로 beforeEach의 1초 설정을 2초로 늘린다.
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 2 })
            const finalizedAsset = await uploadAndFinalizeAsset(fix, file)

            await sleep(2500)
            await fireOnTick()
            await sleep(1000)

            await expect(assetsService.getMany([finalizedAsset.id])).resolves.toHaveLength(1)
        })
    })
})
