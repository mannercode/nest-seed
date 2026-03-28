import { WatchRecordsModule, WatchRecordsService } from 'cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type WatchRecordsFixture = AppTestContext & { watchRecordsService: WatchRecordsService }

export async function createWatchRecordsFixture() {
    const ctx = await createAppTestContext({ imports: [WatchRecordsModule] })

    const watchRecordsService = ctx.module.get(WatchRecordsService)

    return { ...ctx, watchRecordsService }
}
