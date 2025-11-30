import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { createTestFixture, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    file: FixtureFile
    assetsClient: AssetsClient
}

export const createFixture = async () => {
    const fix = await createTestFixture({ imports: [AssetsModule], providers: [AssetsClient] })

    const assetsClient = fix.module.get(AssetsClient)

    return { ...fix, assetsClient, file: fixtureFiles.small }
}
