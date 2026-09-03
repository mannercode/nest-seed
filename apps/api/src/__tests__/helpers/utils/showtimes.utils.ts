import { DateUtil, newObjectIdString, uniq } from '@mannercode/common'
import { instant, oid, type TestContext } from '@mannercode/testing'
import { type CreateShowtimeDto, ShowtimesService } from '#core'

export function buildCreateShowtimeDto(overrides: Partial<CreateShowtimeDto> = {}) {
    const createDto = {
        endTime: instant(),
        movieId: oid(0x0),
        sagaId: newObjectIdString(),
        startTime: instant(),
        theaterId: oid(0x0),
        ...overrides
    }

    if (overrides.endTime === undefined) {
        createDto.endTime = DateUtil.add({ base: createDto.startTime, minutes: 1 })
    }

    return createDto
}

export async function createShowtimes(ctx: TestContext, overrides: Partial<CreateShowtimeDto>[]) {
    const showtimesService = ctx.module.get(ShowtimesService)

    const createDtos = overrides.map((override) => buildCreateShowtimeDto(override))

    await showtimesService.createMany(createDtos)

    const sagaIds = uniq(createDtos.map((dto) => dto.sagaId))

    const showtimes = await showtimesService.search({ sagaIds })
    return showtimes
}
