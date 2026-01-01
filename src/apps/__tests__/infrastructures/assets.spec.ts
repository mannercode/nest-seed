import { HttpStatus } from '@nestjs/common'
import { Checksum, pickIds, sleep } from 'common'
import { nullObjectId, toAny } from 'testlib'
import {
    buildCompleteAssetDto,
    buildCreateAssetDto,
    createAsset,
    downloadAsset,
    fixtureFiles,
    uploadAsset,
    uploadComplete,
    uploadFile
} from '../__helpers__'
import { type AssetsFixture } from './assets.fixture'
import type { AssetDto } from 'apps/infrastructures'

describe('AssetsService', () => {
    let fix: AssetsFixture
    const file = fixtureFiles.small

    beforeEach(async () => {
        const { createAssetsFixture } = await import('./assets.fixture')
        fix = await createAssetsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        describe('when the DTO is valid', () => {
            it('returns an upload request', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                expect(uploadRequest).toEqual({
                    assetId: expect.any(String),
                    url: expect.any(String),
                    expiresAt: expect.any(Date),
                    method: 'PUT',
                    headers: {
                        'Content-Type': createDto.mimeType,
                        'Content-Length': createDto.size.toString(),
                        'x-amz-checksum-sha256': file.checksum.base64
                    }
                })
            })

            it('uploads the file using the upload request', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.ok).toBe(true)
            })
        })

        describe('when the upload URL has expired', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1
            })

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
        describe('when the upload is completed', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })

            it('returns true', async () => {
                const isCompleted = await fix.assetsClient.isUploadComplete(assetId)
                expect(isCompleted).toBe(true)
            })
        })

        describe('when the upload is not completed', () => {
            let assetId: string

            beforeEach(async () => {
                const uploadInfo = await createAsset(fix, file)
                assetId = uploadInfo.assetId
            })

            it('returns false', async () => {
                const isCompleted = await fix.assetsClient.isUploadComplete(assetId)
                expect(isCompleted).toBe(false)
            })
        })
    })

    describe('complete', () => {
        describe('when the upload is completed', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })

            it('returns the asset with download info', async () => {
                const completeDto = buildCompleteAssetDto()

                const asset = await fix.assetsClient.complete(assetId, completeDto)

                expect(asset).toEqual(
                    expect.objectContaining({
                        ...completeDto,
                        download: { url: expect.any(String), expiresAt: expect.any(Date) }
                    })
                )
            })

            it('downloads the asset with matching checksum', async () => {
                const completeDto = buildCompleteAssetDto()
                const asset = await fix.assetsClient.complete(assetId, completeDto)

                const buffer = await downloadAsset(asset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        describe('when the upload has expired', () => {
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1

                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                assetId = uploadRequest.assetId

                await sleep(1500)
            })

            it('throws 404 Not Found', async () => {
                const completeDto = buildCompleteAssetDto()
                await expect(fix.assetsClient.complete(assetId, completeDto)).rejects.toMatchObject(
                    { status: HttpStatus.NOT_FOUND }
                )
            })

            it('persists the deletion', async () => {
                const completeDto = buildCompleteAssetDto()
                await expect(fix.assetsClient.complete(assetId, completeDto)).rejects.toThrow()

                await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('getMany', () => {
        describe('when the assets exist', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadComplete(fix, file),
                    uploadComplete(fix, file),
                    uploadComplete(fix, file)
                ])
            })

            it('returns assets with download info for the assetIds', async () => {
                const fetchedAssets = await fix.assetsClient.getMany(pickIds(assets))

                expect(fetchedAssets).toEqual(
                    expect.arrayContaining(
                        assets.map((asset) => ({
                            ...asset,
                            download: { url: expect.any(String), expiresAt: expect.any(Date) }
                        }))
                    )
                )
            })

            it('downloads the asset with matching checksum', async () => {
                const [fetchedAsset] = await fix.assetsClient.getMany([assets[0].id])

                const buffer = await downloadAsset(fetchedAsset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        describe('when the assetIds include a non-existent assetId', () => {
            it('throws 404 Not Found', async () => {
                await expect(fix.assetsClient.getMany([nullObjectId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('deleteMany', () => {
        describe('when the assets exist', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadComplete(fix, file),
                    uploadComplete(fix, file),
                    uploadComplete(fix, file)
                ])
            })

            it('returns an empty response', async () => {
                const response = await fix.assetsClient.deleteMany(pickIds(assets))
                expect(response).toEqual({})
            })

            it('persists the deletion', async () => {
                await fix.assetsClient.deleteMany([assets[0].id])

                await expect(fix.assetsClient.getMany([assets[0].id])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })

            it('invalidates image URL', async () => {
                await fix.assetsClient.deleteMany([assets[0].id])

                const { download } = assets[0]
                const response = await fetch(download ? download.url : '')
                expect(response.status).toBe(404)
            })
        })

        describe('when the assetIds include a non-existent assetId', () => {
            it('returns an empty response', async () => {
                const response = await fix.assetsClient.deleteMany([nullObjectId])
                expect(response).toEqual({})
            })
        })
    })

    describe('cleanupExpiredUploadsJob', () => {
        describe('when an uploaded asset exists', () => {
            let fireOnTick: () => Promise<void>
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1

                const cronjob = fix.scheduler.getCronJob('assets.cleanupExpiredUploads')
                fireOnTick = cronjob.fireOnTick

                const createDto = buildCreateAssetDto(file)
                const uploadDto = await fix.assetsClient.create(createDto)
                assetId = uploadDto.assetId
            })

            describe('when the upload has not expired', () => {
                it('keeps the asset', async () => {
                    await fireOnTick()
                    await sleep(500)

                    await expect(fix.assetsClient.getMany([assetId])).resolves.toHaveLength(1)
                })
            })

            describe('when the upload has expired', () => {
                beforeEach(async () => {
                    await sleep(1500)
                })

                it('removes the asset', async () => {
                    await fireOnTick()
                    await sleep(500)

                    await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                        status: HttpStatus.NOT_FOUND
                    })
                })
            })
        })
    })
})
