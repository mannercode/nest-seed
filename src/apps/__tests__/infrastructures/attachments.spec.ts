import { HttpStatus } from '@nestjs/common'
import { AttachmentDto } from 'apps/infrastructures'
import { FileUtil, Path } from 'common'
import { readFile, writeFile } from 'fs/promises'
import { nullObjectId } from 'testlib'
import type { Fixture } from './attachments.fixture'

describe('AttachmentsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./attachments.fixture')
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

    const uploadAttachment = async () => {
        const payload = buildUploadPayload()

        const { body: uploadInfo } = await fixture.httpClient
            .post('/attachments')
            .body(payload)
            .created()

        const uploadRes = await fetch(uploadInfo.uploadUrl, {
            method: uploadInfo.method,
            headers: uploadInfo.headers,
            body: await readFile(fixture.localFiles.small.path)
        })

        expect(uploadRes.ok).toBe(true)

        const ownerInfo = { ownerService: 'movies', ownerEntityId: 'movie-1' }
        const completed = await fixture.attachmentsClient.complete(
            uploadInfo.attachmentId,
            ownerInfo
        )

        return { uploadInfo, completed, ownerInfo }
    }

    describe('create', () => {
        it('returns an upload URL and stores the metadata', async () => {
            const payload = buildUploadPayload()

            const body = await fixture.attachmentsClient.create(payload)

            expect(body).toEqual({
                attachmentId: expect.any(String),
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
        describe('when the file exists', () => {
            let uploadedFile: AttachmentDto

            beforeEach(async () => {
                const { completed } = await uploadAttachment()
                uploadedFile = completed
            })

            it('returns a download URL and metadata', async () => {
                const [attachment] = await fixture.attachmentsClient.getMany([uploadedFile.id])

                expect(attachment).toEqual({
                    ...uploadedFile,
                    downloadUrl: expect.any(String),
                    downloadUrlExpiresAt: expect.any(Date)
                })

                const tempDir = await Path.createTempDirectory()
                const downloadedFile = Path.join(tempDir, 'downloaded.tmp')

                try {
                    const downloadRes = await fetch(attachment.downloadUrl!)
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

        describe('when the file does not exist', () => {
            it('throws 404 Not Found', async () => {
                await expect(
                    fixture.attachmentsClient.getMany([nullObjectId])
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            })
        })
    })

    describe('deleteMany', () => {
        describe('when the file exists', () => {
            let uploadedFile: AttachmentDto

            beforeEach(async () => {
                const { completed } = await uploadAttachment()
                uploadedFile = completed
            })

            it('deletes the file metadata', async () => {
                const response = await fixture.attachmentsClient.deleteMany([uploadedFile.id])

                expect(response).toEqual({
                    deletedAttachments: [
                        {
                            id: expect.any(String),
                            originalName: uploadedFile.originalName,
                            mimeType: uploadedFile.mimeType,
                            size: uploadedFile.size,
                            checksum: uploadedFile.checksum,
                            ownerService: uploadedFile.ownerService,
                            ownerEntityId: uploadedFile.ownerEntityId
                        }
                    ]
                })

                await expect(
                    fixture.attachmentsClient.getMany([uploadedFile.id])
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            })
        })

        describe('when the file does not exist', () => {
            it('throws 404 Not Found', async () => {
                await expect(
                    fixture.attachmentsClient.deleteMany([nullObjectId])
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            })
        })
    })
})
