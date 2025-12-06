import { HttpStatus } from '@nestjs/common'
import { AssetDto } from 'apps/infrastructures'
import { FileUtil, Path, sleep } from 'common'
import { writeFile } from 'fs/promises'
import { Rules } from 'shared'
import { nullObjectId, toAny } from 'testlib'
import { fixtureFiles, uploadAndCompleteAsset } from '../__helpers__'
import {
    BufferUtil,
    buildCreateAssetDto,
    downloadAsset,
    uploadAsset,
    uploadFile,
    type AssetsFixture
} from './assets.fixture'

describe('AssetsService', () => {
    let fixture: AssetsFixture

    beforeEach(async () => {
        const { createAssetsFixture } = await import('./assets.fixture')
        fixture = await createAssetsFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('create', () => {
        describe('when the DTO is valid', () => {
            it('returns an upload request', async () => {
                const createDto = buildCreateAssetDto(fixture.file)
                const uploadRequest = await fixture.assetsClient.create(createDto)

                expect(uploadRequest).toEqual({
                    assetId: expect.any(String),
                    url: expect.any(String),
                    expiresAt: expect.any(Date),
                    method: 'PUT',
                    headers: {
                        'Content-Type': createDto.mimeType,
                        'Content-Length': createDto.size.toString(),
                        'x-amz-checksum-sha256': fixture.file.checksum.base64
                    }
                })
            })

            it('uploads the file successfully', async () => {
                const createDto = buildCreateAssetDto(fixture.file)
                const uploadRequest = await fixture.assetsClient.create(createDto)

                const uploadRes = await uploadAsset(fixture.file.path, uploadRequest)
                expect(uploadRes.ok).toBe(true)
            })
        })

        describe('when upload expired', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1
            })

            it('???', async () => {
                const createDto = buildCreateAssetDto(fixture.file)
                const uploadRequest = await fixture.assetsClient.create(createDto)
                await sleep(1500)

                const uploadRes = await uploadAsset(fixture.file.path, uploadRequest)
                expect(uploadRes.ok).toBe(false)
            })
        })
    })

    describe('complete', () => {
        describe('when upload completed', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fixture, fixture.file)
            })

            it('returns owner and download info', async () => {
                const completeDto = { ownerService: 'service', ownerEntityId: 'entity-id' }

                const assetDto = await fixture.assetsClient.complete(assetId, completeDto)

                expect(assetDto).toEqual(
                    expect.objectContaining({
                        owner: { service: 'service', entityId: 'entity-id' },
                        download: { url: expect.any(String), expiresAt: expect.any(Date) }
                    })
                )
            })

            it('downloads the asset with matching checksum', async () => {
                const completeDto = { ownerService: 'service', ownerEntityId: 'entity-id' }

                const assetDto = await fixture.assetsClient.complete(assetId, completeDto)

                const buffer = await downloadAsset(assetDto)
                const checksum = BufferUtil.getChecksum(buffer)

                expect(fixture.file.checksum).toEqual(checksum)
            })
        })

        describe('when upload expired', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1
            })

            it('throws exception', async () => {
                const assetId = await uploadFile(fixture, fixture.file)

                await sleep(1500)

                const completeDto = { ownerService: 'service', ownerEntityId: 'entity-id' }

                const asset = await fixture.assetsClient.complete(assetId, completeDto)
                console.log(asset)
                // expect(uploadRes.ok).toBe(false)
            })
        })
    })

    describe('getMany', () => {
        describe('when the asset exists', () => {
            let uploadedAsset: AssetDto

            beforeEach(async () => {
                uploadedAsset = await uploadAndCompleteAsset(fixture, fixtureFiles.small)
            })

            it('returns a download URL and metadata', async () => {
                const [asset] = await fixture.assetsClient.getMany([uploadedAsset.id])

                expect(asset).toEqual({
                    ...uploadedAsset,
                    download: { url: expect.any(String), expiresAt: expect.any(Date) }
                })

                const downloadedFile = Path.join(fixture.tempDir, 'downloaded.tmp')

                const downloadRes = await fetch(asset.download!.url)
                expect(downloadRes.ok).toBe(true)

                const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer())
                await writeFile(downloadedFile, downloadedBuffer)

                expect(await FileUtil.areEqual(downloadedFile, fixture.file.path)).toBe(true)
            })
        })

        describe('when the asset does not exist', () => {
            it('throws 404 Not Found', async () => {
                await expect(fixture.assetsClient.getMany([nullObjectId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('deleteMany', () => {
        describe('when the asset exists', () => {
            let uploadedAsset: AssetDto

            beforeEach(async () => {
                uploadedAsset = await uploadAndCompleteAsset(fixture, fixtureFiles.small)
            })

            it('deletes the asset metadata', async () => {
                const response = await fixture.assetsClient.deleteMany([uploadedAsset.id])

                expect(response).toEqual({
                    deletedAssets: [
                        {
                            id: expect.any(String),
                            originalName: uploadedAsset.originalName,
                            mimeType: uploadedAsset.mimeType,
                            size: uploadedAsset.size,
                            checksum: uploadedAsset.checksum,
                            owner: uploadedAsset.owner,
                            download: null
                        }
                    ]
                })

                await expect(
                    fixture.assetsClient.getMany([uploadedAsset.id])
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            })
        })

        describe('when the asset does not exist', () => {
            it('throws 404 Not Found', async () => {
                await expect(fixture.assetsClient.deleteMany([nullObjectId])).rejects.toMatchObject(
                    { status: HttpStatus.NOT_FOUND }
                )
            })
        })
    })
})
