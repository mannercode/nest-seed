import { WatchRecordsClient, WatchRecordsModule } from 'apps/cores'
import { TestFixture, setupTestContext } from '../__helpers__'

export interface WatchRecordsFixture extends TestFixture {
    watchRecordsService: WatchRecordsClient
}

export const createFixture = async () => {
    const context = await setupTestContext({
        imports: [WatchRecordsModule],
        providers: [WatchRecordsClient]
    })

    const watchRecordsService = context.module.get(WatchRecordsClient)

    return { ...context, watchRecordsService }
}
