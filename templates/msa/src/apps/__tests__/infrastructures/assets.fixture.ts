import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { SchedulerRegistry } from '@nestjs/schedule'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'

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
