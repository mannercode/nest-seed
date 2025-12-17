import { WatchRecordsClient, WatchRecordsModule } from 'apps/cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type WatchRecordsFixture = AppTestContext & { watchRecordsService: WatchRecordsClient }

export async function createWatchRecordsFixture() {
    const ctx = await createAppTestContext({
        imports: [WatchRecordsModule],
        providers: [WatchRecordsClient]
    })

    const watchRecordsService = ctx.module.get(WatchRecordsClient)

    return { ...ctx, watchRecordsService }
}
