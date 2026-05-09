import { SchedulerRegistry } from '@nestjs/schedule'
import { AssetsService } from 'infrastructure'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type AssetsFixture = AppTestContext & {
    assetsService: AssetsService
    scheduler: SchedulerRegistry
}

export async function createAssetsFixture() {
    const ctx = await createAppTestContext()

    const assetsService = ctx.module.get(AssetsService)
    const scheduler = ctx.module.get(SchedulerRegistry)

    return { ...ctx, assetsService, scheduler }
}
