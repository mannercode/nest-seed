import { nullDate, oid, TestContext } from 'testlib'

export function buildCreateWatchRecordDto(overrides = {}) {
    const createDto = {
        customerId: oid(0x0),
        movieId: oid(0x0),
        purchaseId: oid(0x0),
        watchDate: nullDate,
        ...overrides
    }

    return createDto
}

export async function createWatchRecord(ctx: TestContext, override = {}) {
    const { WatchRecordsClient } = await import('apps/cores')
    const watchRecordsService = ctx.module.get(WatchRecordsClient)

    const createDto = buildCreateWatchRecordDto(override)

    const watchRecord = await watchRecordsService.create(createDto)
    return watchRecord
}
