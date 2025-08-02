import { StorageFileDto } from 'apps/infrastructures'
import { FileUtil, generateShortId, Path } from 'common'
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

    const uploadFile = (attachs: any[], fields?: any[]) =>
        fix.httpClient
            .post('/storage-files')
            .attachments(attachs)
            .fields(fields ?? [{ name: 'name', value: 'test' }])

    describe('POST /storage-files', () => {
        const fields = [{ name: 'name', value: 'test' }]

        // 여러 파일을 성공적으로 저장한다.
        describe('???', () => {
            it('stores multiple files correctly', async () => {
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

        // 첨부 파일이 없어도 요청에 성공한다.
        describe('???', () => {
            it('succeeds even if no file is attached', async () => {
                await fix.httpClient
                    .post('/storage-files')
                    .attachments([])
                    .fields(fields)
                    .created({ storageFiles: [] })
            })
        })

        // 허용된 크기를 초과하면 413 에러를 반환한다.
        describe('???', () => {
            it('returns a 413 Payload Too Large error if the file exceeds the size limit', async () => {
                await fix.httpClient
                    .post('/storage-files')
                    .attachments([{ name: 'files', file: fix.localFiles.oversized.path }])
                    .fields(fields)
                    .payloadTooLarge(expect.objectContaining(Errors.FileUpload.MaxSizeExceeded))
            })
        })

        // 허용된 파일 개수를 초과하면 400 에러를 반환한다.
        describe('???', () => {
            it('returns a BadRequest(400) error if the number of files exceeds the limit', async () => {
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

        // 허용되지 않은 MIME 타입이면 415 에러를 반환한다.
        describe('???', () => {
            it('returns a 415 Unsupported Media Type error for unallowed MIME types', async () => {
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
        describe('when the required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await uploadFile([], []).badRequest({
                    ...Errors.RequestValidation.Failed,
                    details: [{ constraints: { isString: 'name must be a string' }, field: 'name' }]
                })
            })
        })
    })

    describe('GET /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto
        let tempDir: string

        beforeEach(async () => {
            tempDir = await Path.createTempDirectory()
            const uploadedFiles = await uploadStorageFiles(fix, [fix.localFiles.large])
            uploadedFile = uploadedFiles[0]
        })

        afterEach(async () => {
            await Path.delete(tempDir)
        })

        // 파일이 존재할 때
        describe('when the file exists', () => {
            // 파일을 성공적으로 다운로드한다.
            it('downloads the file successfully', async () => {
                const downloadPath = Path.join(tempDir, generateShortId() + '.txt')

                await fix.httpClient
                    .get(`/storage-files/${uploadedFile.id}`)
                    .download(downloadPath)
                    .ok()

                expect(await FileUtil.getSize(downloadPath)).toEqual(uploadedFile.size)
                expect(await FileUtil.getChecksum(downloadPath)).toEqual(uploadedFile.checksum)
            })
        })

        // 파일이 존재하지 않을 때
        describe('when the file does not exist', () => {
            // 404 Not Found 에러를 반환한다.
            it('returns 404 Not Found error', async () => {
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
        let uploadedFile: StorageFileDto

        beforeEach(async () => {
            const uploadedFiles = await uploadStorageFiles(fix, [fix.localFiles.large])
            uploadedFile = uploadedFiles[0]
        })

        // 파일이 존재할 때
        describe('when the file exists', () => {
            // 파일 기록과 물리적 파일을 함께 삭제한다.
            it('deletes the file record and the physical file', async () => {
                const filePath = Path.join(fix.uploadDir, `${uploadedFile.id}.file`)

                expect(Path.existsSync(filePath)).toBeTruthy()

                await fix.httpClient.delete(`/storage-files/${uploadedFile.id}`).ok()
                await fix.httpClient
                    .get(`/storage-files/${uploadedFile.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [uploadedFile.id]
                    })

                expect(Path.existsSync(filePath)).toBeFalsy()
            })
        })

        // 파일이 존재하지 않을 때
        describe('when the file does not exist', () => {
            // 404 Not Found 에러를 반환한다.
            it('returns 404 Not Found error', async () => {
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
