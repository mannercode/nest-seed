import { CreateShowtimeDto } from 'apps/cores'
import { DateUtil, newObjectId } from 'common'
import { uniq } from 'lodash'
import { oid, TestContext } from 'testlib'

export function buildCreateShowtimeDto(overrides: Partial<CreateShowtimeDto> = {}) {
    const createDto = {
        transactionId: newObjectId(),
        movieId: oid(0x0),
        theaterId: oid(0x0),
        startTime: new Date(0),
        endTime: new Date(0),
        ...overrides
    }

    if (overrides.endTime === undefined) {
        createDto.endTime = DateUtil.add({ base: createDto.startTime, minutes: 1 })
    }

    return createDto
}

export async function createShowtimes(
    { module }: TestContext,
    overrides: Partial<CreateShowtimeDto>[]
) {
    const { ShowtimesClient } = await import('apps/cores')
    const showtimesService = module.get(ShowtimesClient)

    const createDtos = overrides.map((override) => buildCreateShowtimeDto(override))

    const { success } = await showtimesService.createMany(createDtos)
    expect(success).toBe(true)

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const showtimes = await showtimesService.search({ transactionIds })
    return showtimes
}
