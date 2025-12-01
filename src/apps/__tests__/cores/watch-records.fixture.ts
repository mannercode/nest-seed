import { WatchRecordsClient, WatchRecordsModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    watchRecordsService: WatchRecordsClient
}

export async function createFixture() {
    const fix = await createTestFixture({
        imports: [WatchRecordsModule],
        providers: [WatchRecordsClient]
    })

    const watchRecordsService = fix.module.get(WatchRecordsClient)

    return { ...fix, watchRecordsService }
}
