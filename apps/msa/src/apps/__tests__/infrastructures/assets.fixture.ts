import { SchedulerRegistry } from '@nestjs/schedule'
import { AssetsClient, AssetsModule } from 'infrastructures'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type AssetsFixture = AppTestContext & {
    assetsClient: AssetsClient
    scheduler: SchedulerRegistry
}

export async function createAssetsFixture() {
    const ctx = await createAppTestContext({ imports: [AssetsModule], providers: [AssetsClient] })

    const assetsClient = ctx.module.get(AssetsClient)
    const scheduler = ctx.module.get(SchedulerRegistry)

    return { ...ctx, assetsClient, scheduler }
}
