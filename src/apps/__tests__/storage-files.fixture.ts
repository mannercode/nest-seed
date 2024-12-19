import { Byte, Path } from 'common'
import { writeFile } from 'fs/promises'
import { GatewayConfigService } from 'gateway/config'
import { StorageFilesService } from 'services/infrastructures'
import { createDummyFile } from 'testlib'
import { createTestContext, TestContext } from './utils'

const maxFileSizeBytes = Byte.fromString('50MB')

export interface SharedFixture {
    tempDir: string
    notAllowFile: string
    oversizedFile: string
    file: string
    largeFile: string
    largeFileSize: number
}

export async function createSharedFixture() {
    const tempDir = await Path.createTempDirectory()

    const file = Path.join(tempDir, 'file.txt')
    await createDummyFile(file, 1024)

    const largeFile = Path.join(tempDir, 'large.txt')
    const largeFileSize = maxFileSizeBytes - 1
    await createDummyFile(largeFile, largeFileSize)

    const notAllowFile = Path.join(tempDir, 'file.json')
    await writeFile(notAllowFile, '{"name":"nest-seed"}')

    const oversizedFile = Path.join(tempDir, 'oversized.txt')
    await createDummyFile(oversizedFile, maxFileSizeBytes + 1)

    return { tempDir, notAllowFile, oversizedFile, largeFile, largeFileSize, file }
}

export async function closeSharedFixture(fixture: SharedFixture) {
    await Path.delete(fixture.tempDir)
}

export interface Fixture {
    testContext: TestContext
    config: GatewayConfigService
    tempDir: string
    storageFilesService: StorageFilesService
}

export async function createFixture() {
    const tempDir = await Path.createTempDirectory()

    const testContext = await createTestContext({
        http: {
            config: {
                FILE_UPLOAD_DIRECTORY: tempDir,
                FILE_UPLOAD_MAX_FILE_SIZE_BYTES: maxFileSizeBytes,
                FILE_UPLOAD_MAX_FILES_PER_UPLOAD: 2,
                FILE_UPLOAD_ALLOWED_FILE_TYPES: 'text/plain'
            }
        },
        svc: { config: { FILE_UPLOAD_DIRECTORY: tempDir } }
    })

    const config = testContext.httpContext.module.get(GatewayConfigService)
    const storageFilesService = testContext.module.get(StorageFilesService)
    return { testContext, config, tempDir, storageFilesService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
    await Path.delete(fixture.tempDir)
}

export async function saveFile(service: StorageFilesService, fixture: SharedFixture) {
    const files = await service.saveFiles([
        {
            originalname: 'large.txt',
            mimetype: 'text/plain',
            size: fixture.largeFileSize,
            path: fixture.largeFile
        }
    ])

    return files[0]
}
