import { newObjectId } from 'common'
import { nullDate } from 'testlib'
import { CommonFixture } from '../__helpers__'

export const buildCreateWatchRecordDto = (overrides = {}) => {
    const createDto = {
        customerId: newObjectId(),
        movieId: newObjectId(),
        purchaseId: newObjectId(),
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
