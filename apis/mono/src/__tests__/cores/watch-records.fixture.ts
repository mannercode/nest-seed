import { WatchRecordsModule, WatchRecordsService } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type WatchRecordsFixture = AppTestContext & { watchRecordsService: WatchRecordsService }

export async function createWatchRecordsFixture() {
    const ctx = await createAppTestContext({ imports: [WatchRecordsModule] })

    const watchRecordsService = ctx.module.get(WatchRecordsService)

    return { ...ctx, watchRecordsService }
}
