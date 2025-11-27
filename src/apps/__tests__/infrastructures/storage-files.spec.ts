import { StorageFileDto } from 'apps/infrastructures'
import { FileUtil, Path } from 'common'
import { readFile, writeFile } from 'fs/promises'
import { nullObjectId } from 'testlib'
import type { Fixture } from './storage-files.fixture'

describe('StorageFilesService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./storage-files.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    const buildPresignPayload = () => ({
        originalName: fixture.localFiles.small.originalName,
        mimeType: fixture.localFiles.small.mimeType,
        size: fixture.localFiles.small.size,
        checksum: fixture.localFiles.small.checksum.value
    })

    const uploadViaPresign = async () => {
        const payload = buildPresignPayload()

        const { body: presign } = await fixture.httpClient
            .post('/storage-files')
            .body(payload)
            .created()

        const uploadRes = await fetch(presign.uploadUrl, {
            method: presign.method,
            headers: presign.headers,
            body: await readFile(fixture.localFiles.small.path)
        })

        expect(uploadRes.ok).toBe(true)

        const ownerInfo = { ownerService: 'movies', ownerEntityId: 'movie-1' }
        const { body: completed } = await fixture.httpClient
            .post(`/storage-files/${presign.key}/complete`)
            .body(ownerInfo)
            .ok()

        return { presign, completed, ownerInfo }
    }

    describe('POST /storage-files', () => {
        it('returns an upload URL and stores the metadata', async () => {
            const payload = buildPresignPayload()

            const { body } = await fixture.httpClient.post('/storage-files').body(payload).created()

            expect(body).toEqual({
                key: expect.any(String),
                uploadUrl: expect.any(String),
                expiresAt: expect.any(Date),
                method: 'PUT',
                headers: expect.objectContaining({
                    'Content-Type': payload.mimeType,
                    'Content-Length': payload.size.toString()
                }),
                storageFile: {
                    id: expect.any(String),
                    originalName: payload.originalName,
                    mimeType: payload.mimeType,
                    size: payload.size,
                    checksum: payload.checksum,
                    storedPath: expect.any(String),
                    ownerService: null,
                    ownerEntityId: null
                }
            })

            expect(body.key).toEqual(body.storageFile.id)
        })
    })

    describe('GET /storage-files/:fileId', () => {
        // 파일이 존재하는 경우
        describe('when the file exists', () => {
            let uploadedFile: StorageFileDto

            beforeEach(async () => {
                const { completed } = await uploadViaPresign()
                uploadedFile = completed
            })

            it('returns a download URL and metadata', async () => {
                const { body } = await fixture.httpClient
                    .get(`/storage-files/${uploadedFile.id}`)
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
                await fixture.httpClient.get(`/storage-files/${nullObjectId}`).notFound()
            })
        })
    })

    describe('DELETE /storage-files/:fileId', () => {
        // 파일이 존재하는 경우
        describe('when the file exists', () => {
            let uploadedFile: StorageFileDto

            beforeEach(async () => {
                const { completed } = await uploadViaPresign()
                uploadedFile = completed
            })

            it('deletes the file metadata', async () => {
                await fixture.httpClient
                    .delete(`/storage-files/${uploadedFile.id}`)
                    .ok({
                        deletedStorageFiles: [
                            {
                                id: expect.any(String),
                                originalName: uploadedFile.originalName,
                                mimeType: uploadedFile.mimeType,
                                size: uploadedFile.size,
                                checksum: uploadedFile.checksum,
                                storedPath: expect.any(String),
                                ownerService: uploadedFile.ownerService,
                                ownerEntityId: uploadedFile.ownerEntityId
                            }
                        ]
                    })

                await fixture.httpClient.get(`/storage-files/${uploadedFile.id}`).notFound()
            })
        })

        // 파일이 존재하지 않는 경우
        describe('when the file does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient.delete(`/storage-files/${nullObjectId}`).notFound()
            })
        })
    })
})
