import { generateShortId, getChecksum, Path } from 'common'
import { AppConfigService } from 'config'
import { StorageFileDto } from 'services/infra'
import { HttpTestClient, nullObjectId } from 'testlib'
import {
    closeFixture,
    closeSharedFixture,
    createFixture,
    createSharedFixture,
    Fixture,
    saveFile,
    SharedFixture
} from './storage-files.fixture'

describe('StorageFiles Module', () => {
    let shared: SharedFixture
    let fixture: Fixture
    let client: HttpTestClient
    let config: AppConfigService

    beforeAll(async () => {
        shared = await createSharedFixture()
    })

    afterAll(async () => {
        await closeSharedFixture(shared)
    })

    beforeEach(async () => {
        fixture = await createFixture()
        client = fixture.testContext.client
        config = fixture.config
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    describe('POST /storage-files', () => {
        const uploadFile = (attachs: any[], fields?: any[]) =>
            client
                .post('/storage-files')
                .attachs(attachs)
                .fields(fields ?? [{ name: 'name', value: 'test' }])

        it('업로드된 파일이 저장된 파일과 동일해야 한다', async () => {
            const { body } = await uploadFile([{ name: 'files', file: shared.file }]).created()

            expect(body.storageFiles[0].checksum).toEqual(await getChecksum(shared.file))
        })

        it('여러 파일을 업로드할 수 있어야 한다', async () => {
            const { body } = await uploadFile([
                { name: 'files', file: shared.file },
                { name: 'files', file: shared.largeFile }
            ]).created()

            expect(body.storageFiles[0].checksum).toEqual(await getChecksum(shared.file))
            expect(body.storageFiles[1].checksum).toEqual(await getChecksum(shared.largeFile))
        })

        it('파일을 첨부하지 않아도 업로드가 성공해야 한다', async () => {
            await uploadFile([]).created()
        })

        it('허용된 크기를 초과하는 파일을 업로드하면 PAYLOAD_TOO_LARGE(413)를 반환해야 한다', async () => {
            await uploadFile([{ name: 'files', file: shared.oversizedFile }]).payloadTooLarge({
                error: 'Payload Too Large',
                message: 'File too large',
                statusCode: 413
            })
        })

        it('허용된 파일 개수를 초과하여 업로드하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            const limitOver = config.fileUpload.maxFilesPerUpload + 1
            const excessFiles = Array(limitOver).fill({ name: 'files', file: shared.file })

            await uploadFile(excessFiles).badRequest({
                error: 'Bad Request',
                message: 'Too many files',
                statusCode: 400
            })
        })

        it('허용되지 않는 MIME 타입의 파일을 업로드하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await uploadFile([{ name: 'files', file: shared.notAllowFile }]).badRequest({
                error: 'Bad Request',
                message: 'File type not allowed. Allowed types are: text/plain',
                statusCode: 400
            })
        })

        it('name 필드를 설정하지 않으면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await uploadFile([], []).badRequest({
                error: 'Bad Request',
                message: ['name must be a string'],
                statusCode: 400
            })
        })
    })

    describe('GET /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto

        beforeEach(async () => {
            uploadedFile = await saveFile(fixture.storageFilesService, shared)
        })

        it('파일을 다운로드해야 한다', async () => {
            const downloadPath = Path.join(shared.tempDir, generateShortId() + '.txt')

            await client.get(`/storage-files/${uploadedFile.id}`).download(downloadPath).ok()

            expect(await Path.getSize(downloadPath)).toEqual(uploadedFile.size)
            expect(await getChecksum(downloadPath)).toEqual(uploadedFile.checksum)
        })

        it('파일이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client.get(`/storage-files/${nullObjectId}`).notFound({
                error: 'Not Found',
                message: `Document with ID ${nullObjectId} not found`,
                statusCode: 404
            })
        })
    })

    describe('DELETE /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto

        beforeEach(async () => {
            uploadedFile = await saveFile(fixture.storageFilesService, shared)
        })

        it('파일을 삭제해야 한다', async () => {
            const filePath = Path.join(config.fileUpload.directory, `${uploadedFile.id}.file`)

            expect(Path.existsSync(filePath)).toBeTruthy()

            await client.delete(`/storage-files/${uploadedFile.id}`).ok()
            await client.get(`/storage-files/${uploadedFile.id}`).notFound({
                error: 'Not Found',
                message: `Document with ID ${uploadedFile.id} not found`,
                statusCode: 404
            })

            expect(Path.existsSync(filePath)).toBeFalsy()
        })

        it('파일이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client.delete(`/storage-files/${nullObjectId}`).notFound({
                error: 'Not Found',
                message: `Document with ID ${nullObjectId} not found`,
                statusCode: 404
            })
        })
    })
})
