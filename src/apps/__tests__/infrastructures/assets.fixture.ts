import { SchedulerRegistry } from '@nestjs/schedule'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'
import type { CronJob } from 'cron'

export type AssetsFixture = AppTestContext & {
    assetsClient: AssetsClient
    cleanupExpiredUploadsJob: CronJob
}

export async function createAssetsFixture() {
    const ctx = await createAppTestContext({ imports: [AssetsModule], providers: [AssetsClient] })

    const assetsClient = ctx.module.get(AssetsClient)
    const scheduler = ctx.module.get(SchedulerRegistry)
    const cleanupExpiredUploadsJob = scheduler.getCronJob('assets.cleanupExpiredUploads')
    await cleanupExpiredUploadsJob.stop()

    return { ...ctx, assetsClient, cleanupExpiredUploadsJob }
}
