import { WatchRecordsClient, WatchRecordsModule } from 'apps/cores'
import { TestFixture, createAppTestContext } from '../__helpers__'

export type WatchRecordsFixture = TestFixture & { watchRecordsService: WatchRecordsClient }

export async function createWatchRecordsFixture() {
    const fix = await createAppTestContext({
        imports: [WatchRecordsModule],
        providers: [WatchRecordsClient]
    })

    const watchRecordsService = fix.module.get(WatchRecordsClient)

    return { ...fix, watchRecordsService }
}
