import { SchedulerRegistry } from '@nestjs/schedule'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { CronJob } from 'cron'
import { createAppTestContext, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'

export type AssetsFixture = TestFixture & {
    assetsClient: AssetsClient
    file: FixtureFile
    cleanupExpiredUploadsJob: CronJob
}

export async function createAssetsFixture() {
    const testFixture = await createAppTestContext({
        imports: [AssetsModule],
        providers: [AssetsClient]
    })

    const assetsClient = testFixture.module.get(AssetsClient)
    const scheduler = testFixture.module.get(SchedulerRegistry)
    const cleanupExpiredUploadsJob = scheduler.getCronJob('assets.cleanupExpiredUploads')
    await cleanupExpiredUploadsJob.stop()

    const file = fixtureFiles.small

    async function teardown() {
        await testFixture.teardown()
    }

    return { ...testFixture, teardown, assetsClient, file, cleanupExpiredUploadsJob }
}
