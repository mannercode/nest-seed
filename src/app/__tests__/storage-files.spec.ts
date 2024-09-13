import { getChecksum, nullObjectId, Path } from 'common'
import { Config } from 'config'
import { writeFile } from 'fs/promises'
import { StorageFileDto } from 'services/storage-files'
import { createDummyFile, createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { AppModule } from '../app.module'

describe('/storage-files', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient

    let tempDir: string
    let notAllowFile: string
    let oversizedFile: string
    let largeFile: string
    let smallFile: string

    beforeAll(async () => {
        tempDir = await Path.createTempDirectory()

        largeFile = Path.join(tempDir, 'large.txt')
        await createDummyFile(largeFile, Config.fileUpload.maxFileSizeBytes - 1)

        smallFile = Path.join(tempDir, 'small.txt')
        await createDummyFile(smallFile, 1024)

        notAllowFile = Path.join(tempDir, 'file.json')
        await writeFile(notAllowFile, '{"name":"nest-seed"}')

        oversizedFile = Path.join(tempDir, 'oversized.txt')
        await createDummyFile(oversizedFile, Config.fileUpload.maxFileSizeBytes + 1)
    })

    afterAll(async () => {
        await Path.delete(tempDir)
    })

    beforeEach(async () => {
        Config.fileUpload = {
            directory: await Path.createTempDirectory(),
            maxFileSizeBytes: 1024 * 1024 * 100,
            maxFilesPerUpload: 2,
            allowedMimeTypes: ['text/plain']
        }

        testContext = await createHttpTestContext({ imports: [AppModule] })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
        await Path.delete(Config.fileUpload.directory)
    })

    async function uploadFile(filePath: string, name = 'test') {
        return client
            .post('/storage-files')
            .attachs([{ name: 'files', file: filePath }])
            .fields([{ name: 'name', value: name }])
            .created()
    }

    describe('POST /storage-files', () => {
        it('Should return CREATED(201) when uploaded file is identical to stored file', async () => {
            const { body } = await uploadFile(largeFile)
            const uploadedFile = body.storageFiles[0]
            expect(uploadedFile.checksum).toEqual(await getChecksum(largeFile))
        })

        it('Should allow uploading multiple files', async () => {
            const { body } = await client
                .post('/storage-files')
                .attachs([
                    { name: 'files', file: largeFile },
                    { name: 'files', file: smallFile }
                ])
                .fields([{ name: 'name', value: 'test' }])
                .created()

            expect(body.storageFiles[0].checksum).toEqual(await getChecksum(largeFile))
            expect(body.storageFiles[1].checksum).toEqual(await getChecksum(smallFile))
        })

        it('Should return CREATED(201) when upload is successful even with no file attached', async () => {
            await client
                .post('/storage-files')
                .attachs([])
                .fields([{ name: 'name', value: 'test' }])
                .created()
        })

        it('Should return PAYLOAD_TOO_LARGE(413) when uploading file exceeding allowed size', async () => {
            await client
                .post('/storage-files')
                .attachs([{ name: 'files', file: oversizedFile }])
                .payloadTooLarge()
        })

        it('Should return BAD_REQUEST(400) when uploading more files than allowed', async () => {
            const limitOver = Config.fileUpload.maxFilesPerUpload + 1
            const excessFiles = Array(limitOver).fill({ name: 'files', file: smallFile })

            await client.post('/storage-files').attachs(excessFiles).badRequest()
        })

        it('should return BAD_REQUEST(400) when uploading a file with disallowed MIME type', async () => {
            await client
                .post('/storage-files')
                .attachs([{ name: 'files', file: notAllowFile }])
                .badRequest()
        })
    })

    describe('GET /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto

        beforeEach(async () => {
            const { body } = await uploadFile(largeFile)
            uploadedFile = body.storageFiles[0]
        })

        it('should get a file', async () => {
            const downloadPath = Path.join(tempDir, 'download.txt')

            await client.get(`/storage-files/${uploadedFile.id}`).download(downloadPath).ok()

            expect(uploadedFile.checksum).toEqual(await getChecksum(downloadPath))
        })

        it('should return NOT_FOUND(404) when file does not exist', async () => {
            await client.get(`/storage-files/${nullObjectId}`).notFound()
        })
    })

    describe('DELETE /storage-files/:fileId', () => {
        let uploadedFile: StorageFileDto

        beforeEach(async () => {
            const { body } = await uploadFile(largeFile)
            uploadedFile = body.storageFiles[0]
        })

        it('should delete a file', async () => {
            const filePath = Path.join(Config.fileUpload.directory, `${uploadedFile.id}.file`)
            expect(Path.existsSync(filePath)).toBeTruthy()

            await client.delete(`/storage-files/${uploadedFile.id}`).ok()
            await client.get(`/storage-files/${uploadedFile.id}`).notFound()

            expect(Path.existsSync(filePath)).toBeFalsy()
        })

        it('should return NOT_FOUND(404) when file does not exist', async () => {
            return client.delete(`/storage-files/${nullObjectId}`).notFound()
        })
    })
})
