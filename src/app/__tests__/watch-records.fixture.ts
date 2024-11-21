import { addDays, nullObjectId, padNumber } from 'common'
import { HttpTestContext, createHttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { WatchRecordsService } from 'services/watch-records'

export interface Fixture {
    testContext: HttpTestContext
    watchRecordsService: WatchRecordsService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const watchRecordsService = testContext.module.get(WatchRecordsService)
    const customerId = 'customerId#1'

    return { testContext, watchRecordsService, customerId }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createWatchRecordDto = (overrides = {}) => {
    const createDto = {
        customerId: '000000000000000000000001',
        movieId: '000000000000000000000002',
        purchaseId: '000000000000000000000003',
        watchDate: new Date('2020-12-12T09:30'),
        ...overrides
    }

    const expectedDto = { id: expect.anything(), ...createDto }

    return { createDto, expectedDto }
}

export const createWatchRecord = async (service: WatchRecordsService, override = {}) => {
    const { createDto } = createWatchRecordDto(override)

    const watchRecord = await service.createWatchRecords(createDto)
    return watchRecord
}

export const createWatchRecords = async (service: WatchRecordsService, overrides = {}) => {
    const baseDate = new Date('2020-12-12T09:30')

    return Promise.all(
        Array.from({ length: 10 }, async (_, index) =>
            createWatchRecord(service, {
                customerId: '000000000000000000000001',
                purchaseId: '000000000000000000000003',
                movieId: `00000000000000000000000${index}`,
                watchDate: addDays(baseDate, index),
                ...overrides
            })
        )
    )
}
