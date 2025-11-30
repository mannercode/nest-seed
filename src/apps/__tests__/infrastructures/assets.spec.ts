import { HttpStatus } from '@nestjs/common'
import { AssetDto } from 'apps/infrastructures'
import { FileUtil, Path } from 'common'
import { readFile, writeFile } from 'fs/promises'
import { nullObjectId } from 'testlib'
import type { Fixture } from './assets.fixture'
import { pick } from 'lodash'

describe('AssetsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./assets.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    const uploadAsset = async () => {
        const createDto = pick(fixture.file, ['originalName', 'mimeType', 'size', 'checksum'])

        const { assetId, uploadRequest } = await fixture.assetsClient.create(createDto)
        const { url, method, headers } = uploadRequest
        const body = await readFile(fixture.file.path)

        const uploadRes = await fetch(url, { method, headers, body })

        expect(uploadRes.ok).toBe(true)

        const owner = { ownerService: 'service-name', ownerEntityId: 'entity-id' }
        const completed = await fixture.assetsClient.complete(assetId, owner)

        return completed
    }

    describe('create', () => {
        describe('when the DTO is valid', () => {
            it('returns an upload request', async () => {
                const createDto = pick(fixture.file, [
                    'originalName',
                    'mimeType',
                    'size',
                    'checksum'
                ])

                const response = await fixture.assetsClient.create(createDto)

                expect(response).toEqual({
                    assetId: expect.any(String),
                    uploadRequest: {
                        url: expect.any(String),
                        expiresAt: expect.any(Date),
                        method: 'PUT',
                        headers: {
                            'Content-Type': createDto.mimeType,
                            'Content-Length': createDto.size.toString(),
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
                uploadedAsset = await uploadAsset()
            })

            it('returns a download URL and metadata', async () => {
                const [asset] = await fixture.assetsClient.getMany([uploadedAsset.id])

                expect(asset).toEqual({
                    ...uploadedAsset,
                    download: { url: expect.any(String), expiresAt: expect.any(Date) }
                })

                const tempDir = await Path.createTempDirectory()
                const downloadedFile = Path.join(tempDir, 'downloaded.tmp')

                try {
                    const downloadRes = await fetch(asset.download!.url)
                    expect(downloadRes.ok).toBe(true)

                    const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer())
                    await writeFile(downloadedFile, downloadedBuffer)

                    expect(await FileUtil.areEqual(downloadedFile, fixture.file.path)).toBe(true)
                } finally {
                    await Path.delete(tempDir)
                }
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
                uploadedAsset = await uploadAsset()
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
