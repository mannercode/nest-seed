import { MulterConfigModule, StorageFilesController } from 'apps/gateway'
import { StorageFilesClient, StorageFilesModule } from 'apps/infrastructures'
import {
    createConfigServiceMock,
    FixtureFile,
    fixtureFiles,
    TestFixture,
    createTestFixture
} from '../__helpers__'

export interface Fixture extends TestFixture {
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

    const maxFilesPerUpload = 3

    const configMock = createConfigServiceMock({
        FILE_UPLOAD_MAX_FILE_SIZE_BYTES: localFiles.oversized.size,
        FILE_UPLOAD_MAX_FILES_PER_UPLOAD: maxFilesPerUpload,
        FILE_UPLOAD_ALLOWED_FILE_TYPES: 'text/plain'
    })

    const fix = await createTestFixture({
        imports: [MulterConfigModule, StorageFilesModule],
        providers: [StorageFilesClient],
        controllers: [StorageFilesController],
        overrideProviders: [configMock]
    })

    const overLimitFiles = Array(maxFilesPerUpload + 1).fill(localFiles.small)

    return { ...fix, overLimitFiles, localFiles }
}
