import type { CreateWatchRecordDto } from 'cores'
import { nullDate, oid, TestContext } from '@mannercode/testing'

export function buildCreateWatchRecordDto(
    overrides: Partial<CreateWatchRecordDto> = {}
): CreateWatchRecordDto {
    return {
        customerId: oid(0x0),
        movieId: oid(0x0),
        purchaseRecordId: oid(0x0),
        watchDate: nullDate,
        ...overrides
    }
}

export async function createWatchRecord(
    ctx: TestContext,
    override: Partial<CreateWatchRecordDto> = {}
) {
    const { WatchRecordsService } = await import('cores')
    const watchRecordsService = ctx.module.get(WatchRecordsService)

    const createDto = buildCreateWatchRecordDto(override)

    const watchRecord = await watchRecordsService.create(createDto)
    return watchRecord
}
