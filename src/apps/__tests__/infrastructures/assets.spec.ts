import { HttpStatus } from '@nestjs/common'
import { AssetDto } from 'apps/infrastructures'
import { FileUtil, Path } from 'common'
import { readFile, writeFile } from 'fs/promises'
import { nullObjectId } from 'testlib'
import type { Fixture } from './assets.fixture'

describe('AssetsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./assets.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    const buildUploadPayload = () => ({
        originalName: fixture.localFiles.small.originalName,
        mimeType: fixture.localFiles.small.mimeType,
        size: fixture.localFiles.small.size,
        checksum: fixture.localFiles.small.checksum.value
    })

    const uploadAsset = async () => {
        const payload = buildUploadPayload()

        const uploadInfo = await fixture.assetsClient.create(payload)

        const uploadRes = await fetch(uploadInfo.uploadUrl, {
            method: uploadInfo.method,
            headers: uploadInfo.headers,
            body: await readFile(fixture.localFiles.small.path)
        })

        expect(uploadRes.ok).toBe(true)

        const ownerInfo = { ownerService: 'movies', ownerEntityId: 'movie-1' }
        const completed = await fixture.assetsClient.complete(uploadInfo.assetId, ownerInfo)

        return { uploadInfo, completed, ownerInfo }
    }

    describe('create', () => {
        it('returns an upload URL and stores the metadata', async () => {
            const payload = buildUploadPayload()

            const body = await fixture.assetsClient.create(payload)

            expect(body).toEqual({
                assetId: expect.any(String),
                uploadUrl: expect.any(String),
                expiresAt: expect.any(Date),
                method: 'PUT',
                headers: expect.objectContaining({
                    'Content-Type': payload.mimeType,
                    'Content-Length': payload.size.toString()
                })
            })
        })
    })

    describe('getMany', () => {
        describe('when the asset exists', () => {
            let uploadedAsset: AssetDto

            beforeEach(async () => {
                const { completed } = await uploadAsset()
                uploadedAsset = completed
            })

            it('returns a download URL and metadata', async () => {
                const [asset] = await fixture.assetsClient.getMany([uploadedAsset.id])

                expect(asset).toEqual({
                    ...uploadedAsset,
                    downloadUrl: expect.any(String),
                    downloadUrlExpiresAt: expect.any(Date)
                })

                const tempDir = await Path.createTempDirectory()
                const downloadedFile = Path.join(tempDir, 'downloaded.tmp')

                try {
                    const downloadRes = await fetch(asset.downloadUrl!)
                    expect(downloadRes.ok).toBe(true)

                    const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer())
                    await writeFile(downloadedFile, downloadedBuffer)

                    expect(
                        await FileUtil.areEqual(downloadedFile, fixture.localFiles.small.path)
                    ).toBe(true)
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
                const { completed } = await uploadAsset()
                uploadedAsset = completed
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
                            ownerService: uploadedAsset.ownerService,
                            ownerEntityId: uploadedAsset.ownerEntityId
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
