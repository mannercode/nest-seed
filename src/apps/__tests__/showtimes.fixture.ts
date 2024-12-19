import { ShowtimeCreateDto, ShowtimeDto, ShowtimesService } from 'cores'
import { omit, uniq } from 'lodash'
import { nullObjectId } from 'testlib'
import { createTestContext, TestContext } from './utils'

export interface Fixture {
    testContext: TestContext
    showtimesService: ShowtimesService
}

export async function createFixture() {
    const testContext = await createTestContext()
    const showtimesService = testContext.module.get(ShowtimesService)

    return { testContext, showtimesService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createShowtimeDto = (overrides = {}) => ({
    batchId: nullObjectId,
    movieId: nullObjectId,
    theaterId: nullObjectId,
    startTime: new Date('2000-01-01T12:00'),
    endTime: new Date('2000-01-01T13:30'),
    ...overrides
})

export const createShowtimeDtos = (overrides = {}, length: number = 100) => {
    const createDtos: ShowtimeCreateDto[] = []
    const expectedDtos: ShowtimeDto[] = []

    for (let i = 0; i < length; i++) {
        const createDto = createShowtimeDto({
            startTime: new Date(2000, 0, 1, i, 0),
            endTime: new Date(2000, 0, 1, i, 90),
            ...overrides
        })

        const expectedDto = { id: expect.any(String), ...omit(createDto, 'batchId') }

        createDtos.push(createDto)
        expectedDtos.push(expectedDto)
    }

    return { createDtos, expectedDtos }
}

export async function createShowtimes(service: ShowtimesService, createDtos: ShowtimeCreateDto[]) {
    const { success } = await service.createShowtimes(createDtos)
    expect(success).toBeTruthy()

    const batchIds = uniq(createDtos.map((dto) => dto.batchId))

    const showtimes = await service.findAllShowtimes({ batchIds })
    return showtimes
}
