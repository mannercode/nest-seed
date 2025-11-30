import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { createTestFixture, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    file: FixtureFile
    assetsClient: AssetsClient
}

export const createFixture = async () => {
    const testFixture = await createTestFixture({ imports: [AssetsModule], providers: [AssetsClient] })

    const assetsClient = testFixture.module.get(AssetsClient)

    return { ...testFixture, assetsClient, file: fixtureFiles.small }
}
