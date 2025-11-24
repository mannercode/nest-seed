import { StorageFileDto } from 'apps/infrastructures'
import { FileUtil, Path } from 'common'
import { nullObjectId } from 'testlib'
import { Errors, uploadStorageFiles } from '../__helpers__'
import type { Fixture } from './storage-files.fixture'

describe('StorageFilesService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./storage-files.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /storage-files', () => {
        const fields = [{ name: 'name', value: 'test' }]

        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 파일을 저장하고 반환한다
            it('stores and returns the files', async () => {
                const files = [fix.localFiles.small, fix.localFiles.large]

                await fix.httpClient
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
                                storedPath: expect.any(String)
                            },
                            {
                                id: expect.any(String),
                                originalName: files[1].originalName,
                                mimeType: files[1].mimeType,
                                size: files[1].size,
                                checksum: await FileUtil.getChecksum(files[1].path),
                                storedPath: expect.any(String)
                            }
                        ]
                    })
            })
        })

        // 첨부 파일이 없는 경우
        describe('when no file is attached', () => {
            // 201 Created를 반환한다
            it('returns 201 Created', async () => {
                await fix.httpClient
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
                await fix.httpClient
                    .post('/storage-files')
                    .attachments([{ name: 'files', file: fix.localFiles.oversized.path }])
                    .fields(fields)
                    .payloadTooLarge(expect.objectContaining(Errors.FileUpload.MaxSizeExceeded))
            })
        })

        // 허용된 파일 개수를 초과하는 경우
        describe('when the number of files exceeds the limit', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const attachments = fix.overLimitFiles.map((file) => ({
                    name: 'files',
                    file: file.path
                }))

                await fix.httpClient
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
                await fix.httpClient
                    .post('/storage-files')
                    .attachments([{ name: 'files', file: fix.localFiles.notAllowed.path }])
                    .fields(fields)
                    .unsupportedMediaType({
                        ...Errors.FileUpload.InvalidFileType,
                        allowedTypes: ['text/plain']
                    })
            })
        })

        // 필수 필드가 누락된 경우
        describe('when required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
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

    describe('GET /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto
        let downloadPath: string

        beforeEach(async () => {
            downloadPath = await Path.createTempDirectory()
            const uploadedFiles = await uploadStorageFiles(fix, [fix.localFiles.large])
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

                await fix.httpClient
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
                await fix.httpClient
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
                const uploadedFiles = await uploadStorageFiles(fix, [fix.localFiles.large])
                uploadedFile = uploadedFiles[0]
            })

            // 파일을 삭제한다
            it('deletes the file', async () => {
                await fix.httpClient
                    .delete(`/storage-files/${uploadedFile.id}`)
                    .ok({
                        deletedStorageFiles: [
                            {
                                id: expect.any(String),
                                originalName: uploadedFile.originalName,
                                mimeType: uploadedFile.mimeType,
                                size: uploadedFile.size,
                                checksum: uploadedFile.checksum,
                                storedPath: expect.any(String)
                            }
                        ]
                    })

                await fix.httpClient.get(`/storage-files/${uploadedFile.id}`).notFound()
            })
        })

        // 파일이 존재하지 않는 경우
        describe('when the file does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .delete(`/storage-files/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })
})
