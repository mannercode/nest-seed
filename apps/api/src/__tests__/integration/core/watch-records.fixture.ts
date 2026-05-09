import { WatchRecordsService } from 'core'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type WatchRecordsFixture = AppTestContext & { watchRecordsService: WatchRecordsService }

export async function createWatchRecordsFixture() {
    const ctx = await createAppTestContext()

    const watchRecordsService = ctx.module.get(WatchRecordsService)

    return { ...ctx, watchRecordsService }
}
