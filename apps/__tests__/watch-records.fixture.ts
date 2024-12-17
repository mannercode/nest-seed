import { addDays } from 'common'
import { WatchRecordsService } from 'services/cores'
import { nullObjectId, testObjectId } from 'testlib'
import { createTestContext, TestContext } from './test.util'

export interface Fixture {
    testContext: TestContext
    watchRecordsService: WatchRecordsService
}

export async function createFixture() {
    const testContext = await createTestContext()
    const watchRecordsService = testContext.module.get(WatchRecordsService)

    return { testContext, watchRecordsService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createWatchRecordDto = (overrides = {}) => {
    const createDto = {
        customerId: nullObjectId,
        movieId: nullObjectId,
        purchaseId: nullObjectId,
        watchDate: new Date(0),
        ...overrides
    }

    const expectedDto = { id: expect.any(String), ...createDto }

    return { createDto, expectedDto }
}

export const createWatchRecord = async (service: WatchRecordsService, override = {}) => {
    const { createDto } = createWatchRecordDto(override)

    const watchRecord = await service.createWatchRecord(createDto)
    return watchRecord
}

export const createWatchRecords = async (service: WatchRecordsService, overrides = {}) => {
    const baseDate = new Date(0)

    return Promise.all(
        Array.from({ length: 10 }, async (_, index) =>
            createWatchRecord(service, {
                movieId: testObjectId(`${index}`),
                watchDate: addDays(baseDate, index),
                ...overrides
            })
        )
    )
}
