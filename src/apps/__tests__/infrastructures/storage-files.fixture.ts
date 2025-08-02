import { Path } from 'common'
import { CommonFixture, createCommonFixture, FixtureFile, fixtureFiles } from '../__helpers__'

export const saveFile = async (fixture: CommonFixture, file: FixtureFile) => {
    const files = await fixture.storageFilesService.saveFiles([file])
    return files[0]
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    uploadDir: string
    overLimitFiles: FixtureFile[]
    localFiles: {
        notAllowed: FixtureFile
        oversized: FixtureFile
        large: FixtureFile
        small: FixtureFile
    }
}

export const createFixture = async () => {
    const localFiles = {
        notAllowed: fixtureFiles.json,
        oversized: fixtureFiles.oversized,
        large: fixtureFiles.large,
        small: fixtureFiles.small
    }
    const uploadDir = await Path.createTempDirectory()
    const maxFileSizeBytes = localFiles.oversized.size
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

    const overLimitFiles = Array(maxFilesPerUpload + 1).fill(localFiles.small)

    const teardown = async () => {
        await fix?.close()
        await Path.delete(uploadDir)
    }

    return { ...fix, teardown, uploadDir, overLimitFiles, localFiles }
}
