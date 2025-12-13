import { HttpStatus } from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'
import { Checksum, FileUtil, Path, sleep } from 'common'
import { writeFile } from 'fs/promises'
import { nullObjectId, toAny } from 'testlib'
import {
    buildCreateAssetDto,
    downloadAsset,
    fixtureFiles,
    uploadAsset,
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
        describe('when the DTO is valid', () => {
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

            it('uploads the file successfully', async () => {
                const createDto = buildCreateAssetDto(fix.file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                const uploadRes = await uploadAsset(fix.file.path, uploadRequest)
                expect(uploadRes.ok).toBe(true)
            })
        })

        describe('when upload expired', () => {
            it('rejects uploads after the URL expires', async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1

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

            it('returns owner and download info', async () => {
                const completeDto = { owner: { service: 'service', entityId: 'entity-id' } }

                const assetDto = await fix.assetsClient.complete(assetId, completeDto)

                expect(assetDto).toEqual(
                    expect.objectContaining({
                        owner: { service: 'service', entityId: 'entity-id' },
                        download: { url: expect.any(String), expiresAt: expect.any(Date) }
                    })
                )
            })

            it('downloads the asset with matching checksum', async () => {
                const completeDto = { owner: { service: 'service', entityId: 'entity-id' } }

                const assetDto = await fix.assetsClient.complete(assetId, completeDto)

                const buffer = await downloadAsset(assetDto)
                const checksum = Checksum.fromBuffer(buffer)

                expect(fix.file.checksum).toEqual(checksum)
            })
        })

        describe('when upload expired', () => {
            it('deletes expired assets instead of completing them', async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1

                const assetId = await uploadFile(fix, fix.file)

                await sleep(1500)

                const completeDto = { owner: { service: 'service', entityId: 'entity-id' } }

                await expect(fix.assetsClient.complete(assetId, completeDto)).rejects.toMatchObject(
                    { status: HttpStatus.GONE }
                )

                await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('getMany', () => {
        describe('when the asset exists', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, fixtureFiles.small)
            })

            it('returns a download URL and metadata', async () => {
                const [asset] = await fix.assetsClient.getMany([assetId])

                expect(asset).toEqual(
                    expect.objectContaining({
                        id: assetId,
                        download: { url: expect.any(String), expiresAt: expect.any(Date) }
                    })
                )

                const downloadedFile = Path.join(fix.tempDir, 'downloaded.tmp')

                const downloadRes = await fetch(asset.download!.url)
                expect(downloadRes.ok).toBe(true)

                const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer())
                await writeFile(downloadedFile, downloadedBuffer)

                expect(await FileUtil.areEqual(downloadedFile, fix.file.path)).toBe(true)
            })
        })

        describe('when the asset does not exist', () => {
            it('throws 404 Not Found', async () => {
                await expect(fix.assetsClient.getMany([nullObjectId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('deleteMany', () => {
        describe('when the asset exists', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, fixtureFiles.small)
            })

            it('deletes the asset metadata', async () => {
                const response = await fix.assetsClient.deleteMany([assetId])

                const { originalName, mimeType, size, checksum } = fixtureFiles.small

                expect(response).toEqual({
                    deletedAssets: [
                        expect.objectContaining({
                            id: assetId,
                            originalName,
                            mimeType,
                            size,
                            checksum,
                            download: null
                        })
                    ]
                })

                await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })

        describe('when the asset does not exist', () => {
            it('throws 404 Not Found', async () => {
                await expect(fix.assetsClient.deleteMany([nullObjectId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('cleanupExpiredUploadsJob', () => {
        it('removes expired uploads that were never completed', async () => {
            const { Rules } = await import('shared')
            toAny(Rules).Asset.uploadExpiresInSec = 1

            const { CronTime } = await import('cron')

            const job = fix.scheduler.getCronJob('assets.cleanupExpiredUploads')
            await job.stop()

            const createDto = buildCreateAssetDto(fix.file)
            const { assetId } = await fix.assetsClient.create(createDto)

            job.setTime(new CronTime(CronExpression.EVERY_SECOND))
            job.start()

            await sleep(2000)

            await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                status: HttpStatus.NOT_FOUND
            })
        })
    })
})
