import { SchedulerRegistry } from '@nestjs/schedule'
import { AssetsModule, AssetsService } from 'infrastructures'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type AssetsFixture = AppTestContext & {
    assetsService: AssetsService
    scheduler: SchedulerRegistry
}

export async function createAssetsFixture() {
    const ctx = await createAppTestContext({ imports: [AssetsModule] })

    const assetsService = ctx.module.get(AssetsService)
    const scheduler = ctx.module.get(SchedulerRegistry)

    return { ...ctx, assetsService, scheduler }
}
