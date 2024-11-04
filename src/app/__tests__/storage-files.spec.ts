import { generateUUID, getChecksum, nullObjectId, Path } from 'common'
import { AppConfigService } from 'config'
import { StorageFileDto } from 'services/storage-files'
import { HttpTestClient } from 'testlib'
import {
    closeIsolatedFixture,
    closeSharedFixture,
    createIsolatedFixture,
    createSharedFixture,
    IsolatedFixture,
    SharedFixture,
    uploadFile
} from './storage-files.fixture'

describe('/storage-files', () => {
    let shared: SharedFixture
    let isolated: IsolatedFixture
    let client: HttpTestClient
    let config: AppConfigService

    beforeAll(async () => {
        shared = await createSharedFixture()
    })

    afterAll(async () => {
        await closeSharedFixture(shared)
    })

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        client = isolated.testContext.client
        config = isolated.config
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    describe('POST /storage-files', () => {
        it('업로드된 파일이 저장된 파일과 동일해야 한다', async () => {
            const { body } = await uploadFile(client, [
                { name: 'files', file: shared.file }
            ]).created()

            expect(body.storageFiles[0].checksum).toEqual(await getChecksum(shared.file))
        })

        it('여러 파일을 업로드할 수 있어야 한다', async () => {
            const { body } = await uploadFile(client, [
                { name: 'files', file: shared.file },
                { name: 'files', file: shared.largeFile }
            ]).created()

            expect(body.storageFiles[0].checksum).toEqual(await getChecksum(shared.file))
            expect(body.storageFiles[1].checksum).toEqual(await getChecksum(shared.largeFile))
        })

        it('파일을 첨부하지 않아도 업로드가 성공해야 한다', async () => {
            await uploadFile(client, []).created()
        })

        it('허용된 크기를 초과하는 파일을 업로드하면 PAYLOAD_TOO_LARGE(413)를 반환해야 한다', async () => {
            await uploadFile(client, [
                { name: 'files', file: shared.oversizedFile }
            ]).payloadTooLarge('File too large')
        })

        it('허용된 파일 개수를 초과하여 업로드하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            const limitOver = config.fileUpload.maxFilesPerUpload + 1
            const excessFiles = Array(limitOver).fill({ name: 'files', file: shared.file })

            await uploadFile(client, excessFiles).badRequest('Too many files')
        })

        it('허용되지 않는 MIME 타입의 파일을 업로드하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await uploadFile(client, [{ name: 'files', file: shared.notAllowFile }]).badRequest(
                'File type not allowed. Allowed types are: text/plain'
            )
        })

        it('name 필드를 설정하지 않으면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await uploadFile(client, [], []).badRequest(['name must be a string'])
        })
    })

    describe('GET /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto

        beforeEach(async () => {
            const { body } = await uploadFile(client, [
                { name: 'files', file: shared.largeFile }
            ]).created()
            uploadedFile = body.storageFiles[0]
        })

        it('파일을 다운로드해야 한다', async () => {
            const downloadPath = Path.join(shared.tempDir, generateUUID() + '.txt')

            await client.get(`/storage-files/${uploadedFile.id}`).download(downloadPath).ok()

            expect(await Path.getSize(downloadPath)).toEqual(uploadedFile.size)
            expect(await getChecksum(downloadPath)).toEqual(uploadedFile.checksum)
        })

        it('파일이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client
                .get(`/storage-files/${nullObjectId}`)
                .notFound('StorageFile with ID 000000000000000000000000 not found')
        })
    })

    describe('DELETE /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto

        beforeEach(async () => {
            const { body } = await uploadFile(client, [
                { name: 'files', file: shared.largeFile }
            ]).created()
            uploadedFile = body.storageFiles[0]
        })

        it('파일을 삭제해야 한다', async () => {
            const filePath = Path.join(config.fileUpload.directory, `${uploadedFile.id}.file`)

            expect(Path.existsSync(filePath)).toBeTruthy()

            await client.delete(`/storage-files/${uploadedFile.id}`).ok()
            await client
                .get(`/storage-files/${uploadedFile.id}`)
                .notFound(`StorageFile with ID ${uploadedFile.id} not found`)

            expect(Path.existsSync(filePath)).toBeFalsy()
        })

        it('파일이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client
                .delete(`/storage-files/${nullObjectId}`)
                .notFound('StorageFile with ID 000000000000000000000000 not found')
        })
    })
})

describe.skip('aborted 오류 테스트', () => {
    let shared: SharedFixture
    let isolated: IsolatedFixture
    let client: HttpTestClient
    let config: AppConfigService

    beforeAll(async () => {
        shared = await createSharedFixture()

        isolated = await createIsolatedFixture()
        client = isolated.testContext.client
        config = isolated.config
    }, 10000)

    afterAll(async () => {
        await closeIsolatedFixture(isolated)
        await closeSharedFixture(shared)
    })

    it(
        '파일을 다운로드해야 한다',
        async () => {
            await Promise.all(
                Array.from({ length: 100 }, async (_, index) => {
                    console.log('start', index)
                    const downloadPath = Path.join(shared.tempDir, generateUUID() + '.txt')

                    const { body } = await uploadFile(client, [
                        { name: 'files', file: shared.largeFile }
                    ]).created()

                    const uploadedFile = body.storageFiles[0]

                    await client
                        .get(`/storage-files/${uploadedFile.id}`)
                        .download(downloadPath)
                        .ok()

                    expect(await Path.getSize(downloadPath)).toEqual(uploadedFile.size)
                    console.log('finish', index)
                })
            )
        },
        500 * 1000
    )
})
