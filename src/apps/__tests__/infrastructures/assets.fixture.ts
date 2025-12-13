import { SchedulerRegistry } from '@nestjs/schedule'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { Path } from 'common'
import { createAppTestContext, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'

export type AssetsFixture = TestFixture & {
    assetsClient: AssetsClient
    file: FixtureFile
    tempDir: string
    scheduler: SchedulerRegistry
}

export async function createAssetsFixture() {
    const testFixture = await createAppTestContext({
        imports: [AssetsModule],
        providers: [AssetsClient]
    })

    const assetsClient = testFixture.module.get(AssetsClient)
    const scheduler = testFixture.module.get(SchedulerRegistry)
    const file = fixtureFiles.small

    const tempDir = await Path.createTempDirectory()

    async function teardown() {
        await testFixture.teardown()
        await Path.delete(tempDir)
    }

    return { ...testFixture, teardown, assetsClient, file, tempDir, scheduler }
}
