import { Path } from 'common'
import { Config } from 'config'
import { writeFile } from 'fs/promises'
import { createDummyFile, createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { AppModule } from '../app.module'

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
    await createDummyFile(largeFile, Config.fileUpload.maxFileSizeBytes - 1)

    const notAllowFile = Path.join(tempDir, 'file.json')
    await writeFile(notAllowFile, '{"name":"nest-seed"}')

    const oversizedFile = Path.join(tempDir, 'oversized.txt')
    await createDummyFile(oversizedFile, Config.fileUpload.maxFileSizeBytes + 1)

    return { tempDir, notAllowFile, oversizedFile, largeFile, file }
}

export async function closeSharedFixture(fixture: SharedFixture) {
    await Path.delete(fixture.tempDir)
}

export interface IsolatedFixture {
    testContext: HttpTestContext
}

export async function createIsolatedFixture() {
    Config.fileUpload = {
        ...Config.fileUpload,
        directory: await Path.createTempDirectory(),
        allowedMimeTypes: ['text/plain']
    }

    const testContext = await createHttpTestContext({ imports: [AppModule] })

    return { testContext }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
    await Path.delete(Config.fileUpload.directory)
}

export function uploadFile(client: HttpTestClient, attachs: any[], fields?: any[]) {
    return client
        .post('/storage-files')
        .attachs(attachs)
        .fields(fields ?? [{ name: 'name', value: 'test' }])
}
