import { StorageFileDto } from 'apps/infrastructures'
import { FileUtil, generateShortId, Path } from 'common'
import { nullObjectId } from 'testlib'
import { Errors } from '../__fixtures__'
import { Fixture, saveFile } from './storage-files.fixture'

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
        const uploadFile = (attachs: any[], fields?: any[]) =>
            fix.httpClient
                .post('/storage-files')
                .attachments(attachs)
                .fields(fields ?? [{ name: 'name', value: 'test' }])

        // 유효한 파일을 업로드할 때
        describe('when uploading valid files', () => {
            // 단일 파일을 성공적으로 저장한다.
            it('stores a single file correctly', async () => {
                const { body } = await uploadFile([
                    { name: 'files', file: fix.files.small.path }
                ]).created()

                expect(body.storageFiles[0].checksum).toEqual(
                    await FileUtil.getChecksum(fix.files.small.path)
                )
            })

            // 여러 파일을 성공적으로 저장한다.
            it('stores multiple files correctly', async () => {
                const { body } = await uploadFile([
                    { name: 'files', file: fix.files.small.path },
                    { name: 'files', file: fix.files.large.path }
                ]).created()

                expect(body.storageFiles[0].checksum).toEqual(
                    await FileUtil.getChecksum(fix.files.small.path)
                )
                expect(body.storageFiles[1].checksum).toEqual(
                    await FileUtil.getChecksum(fix.files.large.path)
                )
            })

            // 첨부 파일이 없어도 요청에 성공한다.
            it('succeeds even if no file is attached', async () => {
                await uploadFile([]).created()
            })
        })

        // 유효하지 않은 파일을 업로드할 때
        describe('when uploading invalid files', () => {
            // 허용된 크기를 초과하면 413 에러를 반환한다.
            it('returns a 413 Payload Too Large error if the file exceeds the size limit', async () => {
                await uploadFile([
                    { name: 'files', file: fix.files.oversized.path }
                ]).payloadTooLarge(expect.objectContaining(Errors.FileUpload.MaxSizeExceeded))
            })

            // 허용된 파일 개수를 초과하면 400 에러를 반환한다.
            it('returns a BadRequest(400) error if the number of files exceeds the limit', async () => {
                const limitOver = fix.maxFilesPerUpload + 1
                const excessFiles = Array(limitOver).fill({
                    name: 'files',
                    file: fix.files.small.path
                })

                await uploadFile(excessFiles).badRequest(
                    expect.objectContaining(Errors.FileUpload.MaxCountExceeded)
                )
            })

            // 허용되지 않은 MIME 타입이면 415 에러를 반환한다.
            it('returns a 415 Unsupported Media Type error for unallowed MIME types', async () => {
                await uploadFile([
                    { name: 'files', file: fix.files.notAllowed.path }
                ]).unsupportedMediaType({
                    ...Errors.FileUpload.InvalidFileType,
                    allowedTypes: ['text/plain']
                })
            })
        })

        // 필수 필드가 누락되었을 때
        describe('when the required fields are missing', () => {
            // BadRequest(400) 에러를 반환한다.
            it('returns a BadRequest(400) error', async () => {
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
            uploadedFile = await saveFile(fix, fix.files.large)
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
                await fix.httpClient.get(`/storage-files/${nullObjectId}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })

    describe('DELETE /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto

        beforeEach(async () => {
            uploadedFile = await saveFile(fix, fix.files.large)
        })

        // 파일이 존재할 때
        describe('when the file exists', () => {
            // 파일 기록과 물리적 파일을 함께 삭제한다.
            it('deletes the file record and the physical file', async () => {
                const filePath = Path.join(fix.uploadDir, `${uploadedFile.id}.file`)

                expect(Path.existsSync(filePath)).toBeTruthy()

                await fix.httpClient.delete(`/storage-files/${uploadedFile.id}`).ok()
                await fix.httpClient.get(`/storage-files/${uploadedFile.id}`).notFound({
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
                await fix.httpClient.delete(`/storage-files/${nullObjectId}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })
})
