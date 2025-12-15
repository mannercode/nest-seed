import { SchedulerRegistry } from '@nestjs/schedule'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { CronJob } from 'cron'
import { createAppTestContext, FixtureFile, fixtureFiles, AppTestContext } from '../__helpers__'

export type AssetsFixture = AppTestContext & {
    assetsClient: AssetsClient
    file: FixtureFile
    cleanupExpiredUploadsJob: CronJob
}

export async function createAssetsFixture() {
    const ctx = await createAppTestContext({ imports: [AssetsModule], providers: [AssetsClient] })

    const assetsClient = ctx.module.get(AssetsClient)
    const scheduler = ctx.module.get(SchedulerRegistry)
    const cleanupExpiredUploadsJob = scheduler.getCronJob('assets.cleanupExpiredUploads')
    await cleanupExpiredUploadsJob.stop()

    const file = fixtureFiles.small

    const teardown = async () => {
        await ctx.teardown()
    }

    return { ...ctx, teardown, assetsClient, file, cleanupExpiredUploadsJob }
}
