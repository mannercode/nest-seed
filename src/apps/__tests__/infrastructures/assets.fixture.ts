import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { createTestFixture, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    overLimitFiles: FixtureFile[]
    localFiles: {
        notAllowed: FixtureFile
        oversized: FixtureFile
        large: FixtureFile
        small: FixtureFile
    }
    assetsClient: AssetsClient
}

export const createFixture = async () => {
    const localFiles = {
        notAllowed: fixtureFiles.json,
        oversized: fixtureFiles.oversized,
        large: fixtureFiles.large,
        small: fixtureFiles.small
    }

    const maxFilesPerUpload = 3

    const fix = await createTestFixture({ imports: [AssetsModule], providers: [AssetsClient] })

    const assetsClient = fix.module.get(AssetsClient)

    const overLimitFiles = Array(maxFilesPerUpload + 1).fill(localFiles.small)

    return { ...fix, overLimitFiles, localFiles, assetsClient }
}
