import { WatchRecordsClient, WatchRecordsModule } from 'apps/cores'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'

export type WatchRecordsFixture = AppTestContext & { watchRecordsClient: WatchRecordsClient }

export async function createWatchRecordsFixture() {
    const ctx = await createAppTestContext({
        imports: [WatchRecordsModule],
        providers: [WatchRecordsClient]
    })

    const watchRecordsClient = ctx.module.get(WatchRecordsClient)

    return { ...ctx, watchRecordsClient }
}
