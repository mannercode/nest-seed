import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { WatchRecordsClient, WatchRecordsModule } from 'apps/cores'

export type WatchRecordsFixture = AppTestContext & { watchRecordsClient: WatchRecordsClient }

export async function createWatchRecordsFixture() {
    const ctx = await createAppTestContext({
        imports: [WatchRecordsModule],
        providers: [WatchRecordsClient]
    })

    const watchRecordsClient = ctx.module.get(WatchRecordsClient)

    return { ...ctx, watchRecordsClient }
}
