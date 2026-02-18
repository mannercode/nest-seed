import type { AssetDto } from 'apps/infrastructures'
import { HttpStatus } from '@nestjs/common'
import {
    buildCreateAssetDto,
    buildFinalizeAssetDto,
    createAsset,
    downloadAsset,
    testAssets,
    uploadAndFinalizeAsset,
    uploadAsset,
    uploadFile
} from 'apps/__tests__/__helpers__'
import { Checksum, pickIds, sleep } from 'common'
import { nullObjectId, toAny } from 'testlib'
import type { AssetsFixture } from './assets.fixture'

describe('AssetsService', () => {
    let fix: AssetsFixture
    const file = testAssets.small

    beforeEach(async () => {
        const { createAssetsFixture } = await import('./assets.fixture')
        fix = await createAssetsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        // DTO가 유효할 때
        describe('when the DTO is valid', () => {
            // 업로드 요청을 반환한다
            it('returns an upload request', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

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

            // 업로드 요청을 사용해 파일을 업로드한다
            it('uploads the file using the upload request', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.ok).toBe(true)
            })
        })

        // 업로드 URL이 만료되었을 때
        describe('when the upload URL has expired', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1
            })

            // URL 만료 후 업로드를 거부한다
            it('rejects uploads after the URL expires', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                await sleep(1500)

                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.ok).toBe(false)
            })
        })
    })

    describe('isUploadComplete', () => {
        // 업로드가 완료되었을 때
        describe('when the upload is completed', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })

            // true를 반환한다
            it('returns true', async () => {
                const isCompleted = await fix.assetsClient.isUploadComplete(assetId)
                expect(isCompleted).toBe(true)
            })
        })

        // 업로드가 완료되지 않았을 때
        describe('when the upload is not completed', () => {
            let assetId: string

            beforeEach(async () => {
                const asset = await createAsset(fix, file)
                assetId = asset.assetId
            })

            // false를 반환한다
            it('returns false', async () => {
                const isCompleted = await fix.assetsClient.isUploadComplete(assetId)
                expect(isCompleted).toBe(false)
            })
        })
    })

    describe('finalizeUpload', () => {
        // 업로드가 완료되었을 때
        describe('when the upload is completed', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })

            // 다운로드 정보가 포함된 에셋을 반환한다
            it('returns the asset with download info', async () => {
                const finalizeDto = buildFinalizeAssetDto()

                const asset = await fix.assetsClient.finalizeUpload(assetId, finalizeDto)

                expect(asset).toEqual(
                    expect.objectContaining({
                        ...finalizeDto,
                        download: { expiresAt: expect.any(Date), url: expect.any(String) }
                    })
                )
            })

            // 체크섬이 일치하는 에셋을 다운로드한다
            it('downloads the asset with matching checksum', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                const asset = await fix.assetsClient.finalizeUpload(assetId, finalizeDto)

                const buffer = await downloadAsset(asset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        // 업로드가 만료되었을 때
        describe('when the upload has expired', () => {
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1

                const createDto = buildCreateAssetDto(file)
                const createdAsset = await fix.assetsClient.create(createDto)
                assetId = createdAsset.assetId

                await sleep(1500)
            })

            // 404 Not Found를 던진다
            it('throws 404 Not Found', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                await expect(
                    fix.assetsClient.finalizeUpload(assetId, finalizeDto)
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                await expect(
                    fix.assetsClient.finalizeUpload(assetId, finalizeDto)
                ).rejects.toThrow()

                await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('getMany', () => {
        // 에셋이 존재할 때
        describe('when the assets exist', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file)
                ])
            })

            // assetIds에 대한 다운로드 정보가 포함된 에셋을 반환한다
            it('returns assets with download info for the assetIds', async () => {
                const fetchedAssets = await fix.assetsClient.getMany(pickIds(assets))

                expect(fetchedAssets).toEqual(
                    expect.arrayContaining(
                        assets.map((asset) => ({
                            ...asset,
                            download: { expiresAt: expect.any(Date), url: expect.any(String) }
                        }))
                    )
                )
            })

            // 체크섬이 일치하는 에셋을 다운로드한다
            it('downloads the asset with matching checksum', async () => {
                const [fetchedAsset] = await fix.assetsClient.getMany([assets[0].id])

                const buffer = await downloadAsset(fetchedAsset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        // assetIds에 존재하지 않는 assetId가 포함될 때
        describe('when the assetIds include a non-existent assetId', () => {
            // 404 Not Found를 던진다
            it('throws 404 Not Found', async () => {
                await expect(fix.assetsClient.getMany([nullObjectId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('deleteMany', () => {
        // 에셋이 존재할 때
        describe('when the assets exist', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file)
                ])
            })

            // 응답을 반환하지 않는다
            it('returns no response', async () => {
                await expect(fix.assetsClient.deleteMany(pickIds(assets))).resolves.toBeUndefined()
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                await fix.assetsClient.deleteMany([assets[0].id])

                await expect(fix.assetsClient.getMany([assets[0].id])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })

            // 이미지 URL을 무효화한다
            it('invalidates image URL', async () => {
                await fix.assetsClient.deleteMany([assets[0].id])

                const { download } = assets[0]
                const response = await fetch(download ? download.url : '')
                expect(response.status).toBe(404)
            })
        })

        // assetIds에 존재하지 않는 assetId가 포함될 때
        describe('when the assetIds include a non-existent assetId', () => {
            // 응답을 반환하지 않는다
            it('returns no response', async () => {
                await expect(fix.assetsClient.deleteMany([nullObjectId])).resolves.toBeUndefined()
            })
        })
    })

    describe('cleanupExpiredUploadsJob', () => {
        // 업로드된 에셋이 존재할 때
        describe('when an uploaded asset exists', () => {
            let fireOnTick: () => Promise<void>
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1
                const cronJob = fix.scheduler.getCronJob('assets.cleanupExpiredUploads')
                fireOnTick = cronJob.fireOnTick

                const createDto = buildCreateAssetDto(file)
                const createdAsset = await fix.assetsClient.create(createDto)
                assetId = createdAsset.assetId
            })

            // 업로드가 만료되지 않았을 때
            describe('when the upload has not expired', () => {
                beforeEach(async () => {
                    await fireOnTick()
                    await sleep(1000)
                })

                // 에셋을 유지한다
                it('keeps the asset', async () => {
                    await expect(fix.assetsClient.getMany([assetId])).resolves.toHaveLength(1)
                })
            })

            // 업로드가 만료되었을 때
            describe('when the upload has expired', () => {
                beforeEach(async () => {
                    const { Rules } = await import('shared')
                    await sleep(Rules.Asset.uploadExpiresInSec * 1000 + 500)

                    await fireOnTick()
                    await sleep(1000)
                })

                // 에셋을 제거한다
                it('removes the asset', async () => {
                    await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                        status: HttpStatus.NOT_FOUND
                    })
                })
            })
        })
    })
})
