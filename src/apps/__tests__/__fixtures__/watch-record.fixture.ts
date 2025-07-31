import { nullDate, oid } from 'testlib'
import { CommonFixture } from '../__helpers__'

export const buildCreateWatchRecordDto = (overrides = {}) => {
    const createDto = {
        customerId: oid(0x0),
        movieId: oid(0x0),
        purchaseId: oid(0x0),
        watchDate: nullDate,
        ...overrides
    }

    return createDto
}

export const createWatchRecord = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateWatchRecordDto(override)

    const watchRecord = await fix.watchRecordsService.createWatchRecord(createDto)
    return watchRecord
}
