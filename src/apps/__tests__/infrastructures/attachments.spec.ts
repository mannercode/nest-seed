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
        const { body: completed } = await fixture.httpClient
            .post(`/attachments/${uploadInfo.attachmentId}/complete`)
            .body(ownerInfo)
            .ok()

        return { uploadInfo, completed, ownerInfo }
    }

    describe('POST /attachments', () => {
        it('returns an upload URL and stores the metadata', async () => {
            const payload = buildUploadPayload()

            const { body } = await fixture.httpClient.post('/attachments').body(payload).created()

            expect(body).toEqual({
                attachmentId: expect.any(String),
                uploadUrl: expect.any(String),
                expiresAt: expect.any(Date),
                method: 'PUT',
                headers: expect.objectContaining({
                    'Content-Type': payload.mimeType,
                    'Content-Length': payload.size.toString()
                }),
                attachment: {
                    id: expect.any(String),
                    originalName: payload.originalName,
                    mimeType: payload.mimeType,
                    size: payload.size,
                    checksum: payload.checksum,
                    ownerService: null,
                    ownerEntityId: null
                }
            })

            expect(body.attachmentId).toEqual(body.attachment.id)
        })
    })

    describe('GET /attachments/:attachmentId', () => {
        // 파일이 존재하는 경우
        describe('when the file exists', () => {
            let uploadedFile: AttachmentDto

            beforeEach(async () => {
                const { completed } = await uploadAttachment()
                uploadedFile = completed
            })

            it('returns a download URL and metadata', async () => {
                const { body } = await fixture.httpClient
                    .get(`/attachments/${uploadedFile.id}`)
                    .ok()

                expect(body).toEqual({
                    ...uploadedFile,
                    downloadUrl: expect.any(String),
                    downloadUrlExpiresAt: expect.any(Date)
                })

                const tempDir = await Path.createTempDirectory()
                const downloadedFile = Path.join(tempDir, 'downloaded.tmp')

                try {
                    const downloadRes = await fetch(body.downloadUrl)
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

        // 파일이 존재하지 않는 경우
        describe('when the file does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient.get(`/attachments/${nullObjectId}`).notFound()
            })
        })
    })

    describe('DELETE /attachments/:attachmentId', () => {
        // 파일이 존재하는 경우
        describe('when the file exists', () => {
            let uploadedFile: AttachmentDto

            beforeEach(async () => {
                const { completed } = await uploadAttachment()
                uploadedFile = completed
            })

            it('deletes the file metadata', async () => {
                await fixture.httpClient
                    .delete(`/attachments/${uploadedFile.id}`)
                    .ok({
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

                await fixture.httpClient.get(`/attachments/${uploadedFile.id}`).notFound()
            })
        })

        // 파일이 존재하지 않는 경우
        describe('when the file does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient.delete(`/attachments/${nullObjectId}`).notFound()
            })
        })
    })
})
