import { ConfigService } from '@nestjs/config'
import { Path, stringToBytes } from 'common'
import { AppConfigService } from 'config'
import { writeFile } from 'fs/promises'
import { createDummyFile, createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { AppModule } from '../app.module'

const maxFileSizeBytes = stringToBytes('50MB')

export interface SharedFixture {
    tempDir: string
    notAllowFile: string
    oversizedFile: string
    file: string
    largeFile: string
}

export async function createSharedFixture() {
    const tempDir = await Path.createTempDirectory()

    const file = Path.join(tempDir, 'file.txt')
    await createDummyFile(file, 1024)

    const largeFile = Path.join(tempDir, 'large.txt')
    await createDummyFile(largeFile, maxFileSizeBytes - 1)

    const notAllowFile = Path.join(tempDir, 'file.json')
    await writeFile(notAllowFile, '{"name":"nest-seed"}')

    const oversizedFile = Path.join(tempDir, 'oversized.txt')
    await createDummyFile(oversizedFile, maxFileSizeBytes + 1)

    return { tempDir, notAllowFile, oversizedFile, largeFile, file }
}

export async function closeSharedFixture(fixture: SharedFixture) {
    await Path.delete(fixture.tempDir)
}

export interface IsolatedFixture {
    testContext: HttpTestContext
    config: AppConfigService
    tempDir: string
}

export async function createIsolatedFixture() {
    const tempDir = await Path.createTempDirectory()

    const realConfigService = new ConfigService()

    const mockConfigService = {
        get: jest.fn((key: string) => {
            const mockValues: Record<string, any> = {
                FILE_UPLOAD_DIRECTORY: tempDir,
                FILE_UPLOAD_MAX_FILE_SIZE_BYTES: maxFileSizeBytes,
                FILE_UPLOAD_MAX_FILES_PER_UPLOAD: 2,
                FILE_UPLOAD_ALLOWED_FILE_TYPES: 'text/plain'
            }

            if (key in mockValues) {
                return mockValues[key]
            }

            return realConfigService.get(key)
        })
    }

    const testContext = await createHttpTestContext({
        imports: [AppModule],
        overrideProviders: [{ original: ConfigService, replacement: mockConfigService }]
    })

    const config = testContext.app.get(AppConfigService)

    return { testContext, config, tempDir }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
    await Path.delete(fixture.tempDir)
}

export function uploadFile(client: HttpTestClient, attachs: any[], fields?: any[]) {
    return client
        .post('/storage-files')
        .attachs(attachs)
        .fields(fields ?? [{ name: 'name', value: 'test' }])
}
