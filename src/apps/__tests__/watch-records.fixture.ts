import { DateUtil } from 'common'
import { WatchRecordsService } from 'cores'
import { nullObjectId, testObjectId } from 'testlib'
import { AllTestContexts, createAllTestContexts } from './utils'

export interface Fixture {
    testContext: AllTestContexts
    watchRecordsService: WatchRecordsService
}

export async function createFixture() {
    const testContext = await createAllTestContexts()
    const module = testContext.coresContext.module
    const watchRecordsService = module.get(WatchRecordsService)

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
                watchDate: DateUtil.addDays(baseDate, index),
                ...overrides
            })
        )
    )
}
