import { AssetsClient, AssetsModule, CreateAssetDto } from 'apps/infrastructures'
import { Path } from 'common'
import { pick } from 'lodash'
import { createTestFixture, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'

export type AssetsFixture = TestFixture & {
    file: FixtureFile
    assetsClient: AssetsClient
    createDto: CreateAssetDto
    tempDir: string
}

export async function createAssetsFixture() {
    const testFixture = await createTestFixture({
        imports: [AssetsModule],
        providers: [AssetsClient]
    })

    const assetsClient = testFixture.module.get(AssetsClient)
    const file = fixtureFiles.small
    const createDto = pick(file, ['originalName', 'mimeType', 'size', 'checksum'])

    const tempDir = await Path.createTempDirectory()

    async function teardown() {
        await testFixture.teardown()
        await Path.delete(tempDir)
    }

    return { ...testFixture, teardown, assetsClient, file, createDto, tempDir }
}

//  fixtureFiles.small
