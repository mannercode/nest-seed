import { CreateShowtimeDto } from 'apps/cores'
import { DateUtil, newObjectId } from 'common'
import { uniq } from 'lodash'
import { oid } from 'testlib'
import { CommonFixture } from '../create-common-fixture'

export const buildCreateShowtimeDto = (overrides: Partial<CreateShowtimeDto> = {}) => {
    const createDto = {
        transactionId: newObjectId(),
        movieId: oid(0x0),
        theaterId: oid(0x0),
        startTime: new Date(0),
        endTime: new Date(0),
        ...overrides
    }

    if (overrides.endTime === undefined) {
        createDto.endTime = DateUtil.addMinutes(createDto.startTime, 1)
    }

    return createDto
}

export const createShowtimes = async (
    fix: CommonFixture,
    overrides: Partial<CreateShowtimeDto>[]
) => {
    const createDtos = overrides.map((override) => buildCreateShowtimeDto(override))

    const { success } = await fix.showtimesService.createShowtimes(createDtos)
    expect(success).toBeTruthy()

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const showtimes = await fix.showtimesService.searchShowtimes({ transactionIds })
    return showtimes
}
