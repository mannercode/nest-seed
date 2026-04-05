import { nullDate, oid, TestContext } from '@mannercode/testing'

export function buildCreateWatchRecordDto(overrides = {}) {
    const createDto = {
        customerId: oid(0x0),
        movieId: oid(0x0),
        purchaseRecordId: oid(0x0),
        watchDate: nullDate,
        ...overrides
    }

    return createDto
}

export async function createWatchRecord(ctx: TestContext, override = {}) {
    const { WatchRecordsService } = await import('cores')
    const watchRecordsService = ctx.module.get(WatchRecordsService)

    const createDto = buildCreateWatchRecordDto(override)

    const watchRecord = await watchRecordsService.create(createDto)
    return watchRecord
}
