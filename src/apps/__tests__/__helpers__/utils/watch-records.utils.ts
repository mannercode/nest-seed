import type { TestContext } from 'testlib'
import { nullDate, oid } from 'testlib'

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
    const { WatchRecordsService } = await import('apps/cores')
    const watchRecordsService = ctx.module.get(WatchRecordsService)

    const createDto = buildCreateWatchRecordDto(override)

    const watchRecord = await watchRecordsService.create(createDto)
    return watchRecord
}
