import { Path } from 'common'
import { CommonFixture, createCommonFixture, TestFile, TestFiles } from '../__helpers__'

export const saveFile = async (fixture: CommonFixture, file: TestFile) => {
    const files = await fixture.storageFilesClient.saveFiles([file])
    return files[0]
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    uploadDir: string
    maxFileSizeBytes: number
    maxFilesPerUpload: number
    files: { notAllowed: TestFile; oversized: TestFile; large: TestFile; small: TestFile }
}

export const createFixture = async () => {
    const files = {
        notAllowed: TestFiles.json,
        oversized: TestFiles.oversized,
        large: TestFiles.large,
        small: TestFiles.small
    }
    const uploadDir = await Path.createTempDirectory()
    const maxFileSizeBytes = files.oversized.size
    const maxFilesPerUpload = 2

    const fix = await createCommonFixture({
        gateway: {
            config: {
                FILE_UPLOAD_DIRECTORY: uploadDir,
                FILE_UPLOAD_MAX_FILE_SIZE_BYTES: maxFileSizeBytes,
                FILE_UPLOAD_MAX_FILES_PER_UPLOAD: maxFilesPerUpload,
                FILE_UPLOAD_ALLOWED_FILE_TYPES: 'text/plain'
            }
        },
        infras: { config: { FILE_UPLOAD_DIRECTORY: uploadDir } }
    })

    const teardown = async () => {
        await fix?.close()
        await Path.delete(uploadDir)
    }

    return { ...fix, teardown, uploadDir, maxFileSizeBytes, maxFilesPerUpload, files }
}
