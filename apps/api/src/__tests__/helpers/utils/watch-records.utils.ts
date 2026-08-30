import { nullInstant, oid, type TestContext } from '@mannercode/testing'
import type { CreateWatchRecordDto } from '#core'

export function buildCreateWatchRecordDto(
    overrides: Partial<CreateWatchRecordDto> = {}
): CreateWatchRecordDto {
    return {
        userId: oid(0x0),
        movieId: oid(0x0),
        purchaseRecordId: oid(0x0),
        watchDate: nullInstant,
        ...overrides
    }
}

export async function createWatchRecord(
    ctx: TestContext,
    override: Partial<CreateWatchRecordDto> = {}
) {
    const { WatchRecordsService } = await import('#core')
    const watchRecordsService = ctx.module.get(WatchRecordsService)

    const createDto = buildCreateWatchRecordDto(override)

    const watchRecord = await watchRecordsService.create(createDto)
    return watchRecord
}
