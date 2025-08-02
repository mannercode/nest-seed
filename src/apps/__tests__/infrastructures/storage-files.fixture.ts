import { CommonFixture, createCommonFixture, FixtureFile, fixtureFiles } from '../__helpers__'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
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
    const maxFileSizeBytes = localFiles.oversized.size
    const maxFilesPerUpload = 3

    const fix = await createCommonFixture({
        gateway: {
            config: {
                FILE_UPLOAD_MAX_FILE_SIZE_BYTES: maxFileSizeBytes,
                FILE_UPLOAD_MAX_FILES_PER_UPLOAD: maxFilesPerUpload,
                FILE_UPLOAD_ALLOWED_FILE_TYPES: 'text/plain'
            }
        }
    })

    const overLimitFiles = Array(maxFilesPerUpload + 1).fill(localFiles.small)

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown, overLimitFiles, localFiles }
}
