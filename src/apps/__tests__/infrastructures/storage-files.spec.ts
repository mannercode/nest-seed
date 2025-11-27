import { StorageFileDto } from 'apps/infrastructures'
import { FileUtil, Path } from 'common'
import { readFile, writeFile } from 'fs/promises'
import { nullObjectId } from 'testlib'
import { Errors, uploadStorageFiles } from '../__helpers__'
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

    describe('POST /storage-files', () => {
        const fields = [{ name: 'name', value: 'test' }]

        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 파일을 저장하고 반환한다
            it('stores and returns the files', async () => {
                const files = [fixture.localFiles.small, fixture.localFiles.large]

                await fixture.httpClient
                    .post('/storage-files')
                    .attachments([
                        { name: 'files', file: files[0].path },
                        { name: 'files', file: files[1].path }
                    ])
                    .fields(fields)
                    .created({
                        storageFiles: [
                            {
                                id: expect.any(String),
                                originalName: files[0].originalName,
                                mimeType: files[0].mimeType,
                                size: files[0].size,
                                checksum: await FileUtil.getChecksum(files[0].path),
                                storedPath: expect.any(String),
                                ownerService: null,
                                ownerEntityId: null
                            },
                            {
                                id: expect.any(String),
                                originalName: files[1].originalName,
                                mimeType: files[1].mimeType,
                                size: files[1].size,
                                checksum: await FileUtil.getChecksum(files[1].path),
                                storedPath: expect.any(String),
                                ownerService: null,
                                ownerEntityId: null
                            }
                        ]
                    })
            })
        })

        // 첨부 파일이 없는 경우
        describe('when no file is attached', () => {
            // 201 Created를 반환한다
            it('returns 201 Created', async () => {
                await fixture.httpClient
                    .post('/storage-files')
                    .attachments([])
                    .fields(fields)
                    .created({ storageFiles: [] })
            })
        })

        // 허용된 크기를 초과하는 경우
        describe('when the file size exceeds the limit', () => {
            // 413 Payload Too Large를 반환한다
            it('returns 413 Payload Too Large', async () => {
                await fixture.httpClient
                    .post('/storage-files')
                    .attachments([{ name: 'files', file: fixture.localFiles.oversized.path }])
                    .fields(fields)
                    .payloadTooLarge(expect.objectContaining(Errors.FileUpload.MaxSizeExceeded))
            })
        })

        // 파일 개수가 제한을 초과하는 경우
        describe('when the file count exceeds the limit', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const attachments = fixture.overLimitFiles.map((file) => ({
                    name: 'files',
                    file: file.path
                }))

                await fixture.httpClient
                    .post('/storage-files')
                    .attachments(attachments)
                    .fields(fields)
                    .badRequest(expect.objectContaining(Errors.FileUpload.MaxCountExceeded))
            })
        })

        // 허용되지 않은 파일 형식인 경우
        describe('when the file type is not allowed', () => {
            // 415 Unsupported Media Type를 반환한다
            it('returns 415 Unsupported Media Type', async () => {
                await fixture.httpClient
                    .post('/storage-files')
                    .attachments([{ name: 'files', file: fixture.localFiles.notAllowed.path }])
                    .fields(fields)
                    .unsupportedMediaType({
                        ...Errors.FileUpload.InvalidFileType,
                        allowedTypes: ['text/plain']
                    })
            })
        })

        // 필수 필드가 누락된 경우
        describe('when the required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/storage-files')
                    .attachments([])
                    .fields([])
                    .badRequest({
                        ...Errors.RequestValidation.Failed,
                        details: [
                            { constraints: { isString: 'name must be a string' }, field: 'name' }
                        ]
                    })
            })
        })
    })

    describe('POST /storage-files/presign-upload', () => {
        const buildPresignPayload = () => ({
            originalName: fixture.localFiles.small.originalName,
            mimeType: fixture.localFiles.small.mimeType,
            size: fixture.localFiles.small.size,
            checksum: fixture.localFiles.small.checksum.value
        })

        it('returns an upload URL and stores the metadata', async () => {
            const payload = buildPresignPayload()

            const { body } = await fixture.httpClient
                .post('/storage-files/presign-upload')
                .body(payload)
                .created()

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

        it('completes the uploaded file and issues a download URL', async () => {
            const payload = buildPresignPayload()

            const { body: upload } = await fixture.httpClient
                .post('/storage-files/presign-upload')
                .body(payload)
                .created()

            const uploadRes = await fetch(upload.uploadUrl, {
                method: upload.method,
                headers: upload.headers,
                body: await readFile(fixture.localFiles.small.path)
            })

            expect(uploadRes.ok).toBe(true)

            const ownerInfo = { ownerService: 'movies', ownerEntityId: 'movie-1' }
            const { body: completed } = await fixture.httpClient
                .post(`/storage-files/${upload.key}/complete`)
                .body(ownerInfo)
                .ok()

            expect(completed).toEqual({
                id: upload.key,
                originalName: payload.originalName,
                mimeType: payload.mimeType,
                size: payload.size,
                checksum: payload.checksum,
                storedPath: expect.any(String),
                ownerService: ownerInfo.ownerService,
                ownerEntityId: ownerInfo.ownerEntityId
            })

            const { body: download } = await fixture.httpClient
                .get(`/storage-files/${upload.key}/presign-download`)
                .ok()

            expect(download).toEqual({
                key: upload.key,
                downloadUrl: expect.any(String),
                expiresAt: expect.any(Date),
                storageFile: completed
            })

            const tempDir = await Path.createTempDirectory()
            const downloadedFile = Path.join(tempDir, 'downloaded.tmp')

            try {
                const downloadRes = await fetch(download.downloadUrl)
                expect(downloadRes.ok).toBe(true)

                const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer())
                await writeFile(downloadedFile, downloadedBuffer)

                expect(await FileUtil.areEqual(downloadedFile, fixture.localFiles.small.path)).toBe(
                    true
                )
            } finally {
                await Path.delete(tempDir)
            }
        })
    })

    describe('GET /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto
        let downloadPath: string

        beforeEach(async () => {
            downloadPath = await Path.createTempDirectory()
            const uploadedFiles = await uploadStorageFiles(fixture, [fixture.localFiles.large])
            uploadedFile = uploadedFiles[0]
        })

        afterEach(async () => {
            await Path.delete(downloadPath)
        })

        // 파일이 존재하는 경우
        describe('when the file exists', () => {
            // 파일을 다운로드한다
            it('downloads the file', async () => {
                const downloadFile = Path.join(downloadPath, 'download.txt')

                await fixture.httpClient
                    .get(`/storage-files/${uploadedFile.id}`)
                    .download(downloadFile)
                    .ok()

                expect(await FileUtil.getSize(downloadFile)).toEqual(uploadedFile.size)
                expect(await FileUtil.getChecksum(downloadFile)).toEqual(uploadedFile.checksum)
            })
        })

        // 파일이 존재하지 않는 경우
        describe('when the file does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .get(`/storage-files/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })

    describe('DELETE /storage-files/:fileId', () => {
        // 파일이 존재하는 경우
        describe('when the file exists', () => {
            let uploadedFile: StorageFileDto

            beforeEach(async () => {
                const uploadedFiles = await uploadStorageFiles(fixture, [fixture.localFiles.large])
                uploadedFile = uploadedFiles[0]
            })

            // 파일을 삭제한다
            it('deletes the file', async () => {
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
                                ownerService: null,
                                ownerEntityId: null
                            }
                        ]
                    })

                await fixture.httpClient.get(`/storage-files/${uploadedFile.id}`).notFound()
            })
        })

        // 파일이 존재하지 않는 경우
        describe('when the file does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .delete(`/storage-files/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })
})
