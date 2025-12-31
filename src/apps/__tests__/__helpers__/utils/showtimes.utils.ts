import { DateUtil, newObjectId } from 'common'
import { uniq } from 'lodash'
import { oid } from 'testlib'
import type { CreateShowtimeDto } from 'apps/cores'
import type { TestContext } from 'testlib'

export function buildCreateShowtimeDto(overrides: Partial<CreateShowtimeDto> = {}) {
    const createDto = {
        sagaId: newObjectId(),
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

export async function createShowtimes(ctx: TestContext, overrides: Partial<CreateShowtimeDto>[]) {
    const { ShowtimesService } = await import('apps/cores')
    const showtimesService = ctx.module.get(ShowtimesService)

    const createDtos = overrides.map((override) => buildCreateShowtimeDto(override))

    const { success } = await showtimesService.createMany(createDtos)
    expect(success).toBe(true)

    const sagaIds = uniq(createDtos.map((dto) => dto.sagaId))

    const showtimes = await showtimesService.search({ sagaIds })
    return showtimes
}
