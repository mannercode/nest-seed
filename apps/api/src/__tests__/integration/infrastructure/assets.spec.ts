import type { AssetDto } from 'infrastructure'
import { Checksum, pickIds, sleep } from '@mannercode/common'
import { nullObjectId, toAny } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import type { AssetsFixture } from './assets.fixture'
import {
    buildCreateAssetDto,
    buildFinalizeAssetDto,
    createAsset,
    downloadAsset,
    testAssets,
    uploadAndFinalizeAsset,
    uploadAsset,
    uploadFile
} from '../helpers'

describe('AssetsService', () => {
    let fix: AssetsFixture
    const file = testAssets.small

    beforeEach(async () => {
        const { createAssetsFixture } = await import('./assets.fixture')
        fix = await createAssetsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        describe('DTO가 유효할 때', () => {
            it('업로드 요청을 반환한다', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsService.create(createDto)

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

            it('업로드 요청을 사용해 파일을 업로드한다', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsService.create(createDto)

                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.ok).toBe(true)
            })
        })

        describe('업로드 URL이 만료되었을 때', () => {
            beforeEach(async () => {
                const { Rules } = await import('config')
                toAny(Rules).Asset.uploadExpiresInSec = 1
            })

            it('URL 만료 후 업로드를 거부한다', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsService.create(createDto)

                await sleep(1500)

                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.ok).toBe(false)
            })
        })
    })

    describe('isUploadComplete', () => {
        describe('업로드가 완료되었을 때', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })

            it('true를 반환한다', async () => {
                const isCompleted = await fix.assetsService.isUploadComplete(assetId)
                expect(isCompleted).toBe(true)
            })
        })

        describe('업로드가 완료되지 않았을 때', () => {
            let assetId: string

            beforeEach(async () => {
                const asset = await createAsset(fix, file)
                assetId = asset.assetId
            })

            it('false를 반환한다', async () => {
                const isCompleted = await fix.assetsService.isUploadComplete(assetId)
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

            it('다운로드 정보가 포함된 에셋을 반환한다', async () => {
                const finalizeDto = buildFinalizeAssetDto()

                const asset = await fix.assetsService.finalizeUpload(assetId, finalizeDto)

                expect(asset).toEqual(
                    expect.objectContaining({
                        ...finalizeDto,
                        download: { expiresAt: expect.any(Date), url: expect.any(String) }
                    })
                )
            })

            it('체크섬이 일치하는 에셋을 다운로드한다', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                const asset = await fix.assetsService.finalizeUpload(assetId, finalizeDto)

                const buffer = await downloadAsset(asset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        describe('업로드가 만료되었을 때', () => {
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('config')
                toAny(Rules).Asset.uploadExpiresInSec = 1

                const createDto = buildCreateAssetDto(file)
                const createdAsset = await fix.assetsService.create(createDto)
                assetId = createdAsset.assetId

                await sleep(1500)
            })

            it('404 Not Found를 던진다', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                await expect(
                    fix.assetsService.finalizeUpload(assetId, finalizeDto)
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            })

            it('삭제가 저장된다', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                await expect(
                    fix.assetsService.finalizeUpload(assetId, finalizeDto)
                ).rejects.toThrow()

                await expect(fix.assetsService.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
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

            it('assetIds에 대한 다운로드 정보가 포함된 에셋을 반환한다', async () => {
                const fetchedAssets = await fix.assetsService.getMany(pickIds(assets))

                expect(fetchedAssets).toEqual(
                    expect.arrayContaining(
                        assets.map((asset) => ({
                            ...asset,
                            download: { expiresAt: expect.any(Date), url: expect.any(String) }
                        }))
                    )
                )
            })

            it('체크섬이 일치하는 에셋을 다운로드한다', async () => {
                const [fetchedAsset] = await fix.assetsService.getMany([assets[0].id])

                const buffer = await downloadAsset(fetchedAsset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        describe('assetIds에 존재하지 않는 assetId가 포함될 때', () => {
            it('404 Not Found를 던진다', async () => {
                await expect(fix.assetsService.getMany([nullObjectId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
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

            it('응답을 반환하지 않는다', async () => {
                await expect(fix.assetsService.deleteMany(pickIds(assets))).resolves.toBeUndefined()
            })

            it('삭제가 저장된다', async () => {
                await fix.assetsService.deleteMany([assets[0].id])

                await expect(fix.assetsService.getMany([assets[0].id])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })

            it('이미지 URL을 무효화한다', async () => {
                await fix.assetsService.deleteMany([assets[0].id])

                const { download } = assets[0]
                const response = await fetch(download ? download.url : '')
                expect(response.status).toBe(404)
            })
        })

        describe('assetIds에 존재하지 않는 assetId가 포함될 때', () => {
            it('응답을 반환하지 않는다', async () => {
                await expect(fix.assetsService.deleteMany([nullObjectId])).resolves.toBeUndefined()
            })
        })
    })

    describe('cleanupExpiredUploadsJob', () => {
        describe('업로드된 에셋이 존재할 때', () => {
            let fireOnTick: () => Promise<void>
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('config')
                toAny(Rules).Asset.uploadExpiresInSec = 1
                const cronJob = fix.scheduler.getCronJob('assets.cleanupExpiredUploads')
                fireOnTick = cronJob.fireOnTick

                const createDto = buildCreateAssetDto(file)
                const createdAsset = await fix.assetsService.create(createDto)
                assetId = createdAsset.assetId
            })

            describe('업로드가 만료되지 않았을 때', () => {
                beforeEach(async () => {
                    await fireOnTick()
                    await sleep(1000)
                })

                it('에셋을 유지한다', async () => {
                    await expect(fix.assetsService.getMany([assetId])).resolves.toHaveLength(1)
                })
            })

            describe('업로드가 만료되었을 때', () => {
                beforeEach(async () => {
                    const { Rules } = await import('config')
                    await sleep(Rules.Asset.uploadExpiresInSec * 1000 + 500)

                    await fireOnTick()
                    await sleep(1000)
                })

                it('에셋을 제거한다', async () => {
                    await expect(fix.assetsService.getMany([assetId])).rejects.toMatchObject({
                        status: HttpStatus.NOT_FOUND
                    })
                })
            })
        })
    })
})
