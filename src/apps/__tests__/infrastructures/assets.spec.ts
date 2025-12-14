import { HttpStatus } from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'
import { AssetDto } from 'apps/infrastructures'
import { Checksum, pickIds, sleep } from 'common'
import { nullObjectId, toAny } from 'testlib'
import {
    buildCompleteAssetDto,
    buildCreateAssetDto,
    downloadAsset,
    fixtureFiles,
    uploadAsset,
    uploadComplete,
    uploadFile
} from '../__helpers__'
import { type AssetsFixture } from './assets.fixture'

describe('AssetsService', () => {
    let fix: AssetsFixture

    beforeEach(async () => {
        const { createAssetsFixture } = await import('./assets.fixture')
        fix = await createAssetsFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('create', () => {
        it('returns an upload request', async () => {
            const createDto = buildCreateAssetDto(fix.file)
            const uploadRequest = await fix.assetsClient.create(createDto)

            expect(uploadRequest).toEqual({
                assetId: expect.any(String),
                url: expect.any(String),
                expiresAt: expect.any(Date),
                method: 'PUT',
                headers: {
                    'Content-Type': createDto.mimeType,
                    'Content-Length': createDto.size.toString(),
                    'x-amz-checksum-sha256': fix.file.checksum.base64
                }
            })
        })

        it('upload request로 파일을 업로드 한다', async () => {
            const createDto = buildCreateAssetDto(fix.file)
            const uploadRequest = await fix.assetsClient.create(createDto)

            const uploadRes = await uploadAsset(fix.file.path, uploadRequest)
            expect(uploadRes.ok).toBe(true)
        })

        describe('업로드 시간이 만료되는 경우', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1
            })

            it('업로드는 실패한다', async () => {
                const createDto = buildCreateAssetDto(fix.file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                await sleep(1500)

                const uploadRes = await uploadAsset(fix.file.path, uploadRequest)
                expect(uploadRes.ok).toBe(false)
            })
        })
    })

    describe('complete', () => {
        describe('when upload completed', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, fix.file)
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

            it('download info로 파일을 다운로드 한다', async () => {
                const completeDto = buildCompleteAssetDto()
                const asset = await fix.assetsClient.complete(assetId, completeDto)

                const buffer = await downloadAsset(asset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(fix.file.checksum).toEqual(checksum)
            })
        })

        describe('when the upload is expired', () => {
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1

                assetId = await uploadFile(fix, fix.file)

                await sleep(1500)
            })

            it('throws 410 Gone for an expired upload', async () => {
                const completeDto = buildCompleteAssetDto()
                await expect(fix.assetsClient.complete(assetId, completeDto)).rejects.toMatchObject(
                    { status: HttpStatus.GONE }
                )
            })
        })
    })

    describe('getMany', () => {
        describe('when the assets exist', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadComplete(fix, fixtureFiles.small),
                    uploadComplete(fix, fixtureFiles.small),
                    uploadComplete(fix, fixtureFiles.small)
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

            it('asset의 download info로 파일을 다운로드 한다', async () => {
                const [fetchedAsset] = await fix.assetsClient.getMany([assets[0].id])

                const buffer = await downloadAsset(fetchedAsset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(fix.file.checksum).toEqual(checksum)
            })
        })

        it('throws 404 Not Found for a non-existent asset', async () => {
            await expect(fix.assetsClient.getMany([nullObjectId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })
    })

    describe('deleteMany', () => {
        describe('when the assets exist', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadComplete(fix, fixtureFiles.small),
                    uploadComplete(fix, fixtureFiles.small),
                    uploadComplete(fix, fixtureFiles.small)
                ])
            })

            it('returns deleted assets', async () => {
                const response = await fix.assetsClient.deleteMany(pickIds(assets))

                const deletedAssets = expect.arrayContaining(
                    assets.map((asset) => ({ ...asset, download: null }))
                )
                expect(response).toEqual({ deletedAssets })
            })

            it('persists the deletion', async () => {
                await fix.assetsClient.deleteMany([assets[0].id])

                await expect(fix.assetsClient.getMany([assets[0].id])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })

            it('makes the asset download URL inaccessible after deletion', async () => {
                await fix.assetsClient.deleteMany([assets[0].id])

                const response = await fetch(assets[0].download!.url)
                expect(response.ok).toBe(false)
            })
        })

        it('throws 404 Not Found for a non-existent asset', async () => {
            await expect(fix.assetsClient.deleteMany([nullObjectId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })
    })

    describe('cleanupExpiredUploadsJob', () => {
        it('removes expired uploads that were never completed', async () => {
            const { Rules } = await import('shared')
            toAny(Rules).Asset.uploadExpiresInSec = 1

            const job = fix.scheduler.getCronJob('assets.cleanupExpiredUploads')
            await job.stop()

            const createDto = buildCreateAssetDto(fix.file)
            const { assetId } = await fix.assetsClient.create(createDto)

            const { CronTime } = await import('cron')
            job.setTime(new CronTime(CronExpression.EVERY_SECOND))
            job.start()

            await sleep(2000)

            await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })
    })
})
