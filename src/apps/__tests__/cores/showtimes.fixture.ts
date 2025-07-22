import { CreateShowtimeDto, ShowtimeDto } from 'apps/cores'
import { DateUtil } from 'common'
import { CommonFixture, createCommonFixture } from '../__helpers__'
import { buildCreateShowtimeDto } from '../common.fixture'

export const buildCreateShowtimeDtos = (
    startTimes: Date[],
    overrides: Partial<CreateShowtimeDto> = {}
) => {
    const createDtos: CreateShowtimeDto[] = []
    const expectedDtos: ShowtimeDto[] = []

    startTimes.map((startTime) => {
        const { createDto, expectedDto } = buildCreateShowtimeDto({
            startTime,
            endTime: DateUtil.addMinutes(startTime, 1),
            ...overrides
        })

        createDtos.push(createDto)
        expectedDtos.push(expectedDto)
    })

    return { createDtos, expectedDtos }
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown }
}
