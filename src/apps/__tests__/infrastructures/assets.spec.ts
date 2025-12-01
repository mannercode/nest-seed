import { HttpStatus } from '@nestjs/common'
import { AssetDto } from 'apps/infrastructures'
import { FileUtil, Path } from 'common'
import { writeFile } from 'fs/promises'
import { nullObjectId } from 'testlib'
import { uploadAndCompleteAsset, type Fixture } from './assets.fixture'

describe('AssetsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./assets.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('create', () => {
        describe('when the DTO is valid', () => {
            it('returns an upload request', async () => {
                const response = await fixture.assetsClient.create(fixture.createDto)

                expect(response).toEqual({
                    assetId: expect.any(String),
                    uploadRequest: {
                        url: expect.any(String),
                        expiresAt: expect.any(Date),
                        method: 'PUT',
                        headers: {
                            'Content-Type': fixture.createDto.mimeType,
                            'Content-Length': fixture.createDto.size.toString(),
                            'x-amz-checksum-sha256': expect.any(String)
                        }
                    }
                })
            })
        })
    })

    describe('getMany', () => {
        describe('when the asset exists', () => {
            let uploadedAsset: AssetDto

            beforeEach(async () => {
                uploadedAsset = await uploadAndCompleteAsset(fixture)
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
                uploadedAsset = await uploadAndCompleteAsset(fixture)
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
