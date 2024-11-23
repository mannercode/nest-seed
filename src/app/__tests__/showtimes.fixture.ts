import { omit } from 'lodash'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { HttpTestContext, createHttpTestContext, nullObjectId } from 'testlib'
import { AppModule, configureApp } from '../app.module'

export interface Fixture {
    testContext: HttpTestContext
    showtimesService: ShowtimesService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
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

        const expectedDto = { id: expect.anything(), ...omit(createDto, 'batchId') }

        createDtos.push(createDto)
        expectedDtos.push(expectedDto)
    }

    return { createDtos, expectedDtos }
}

export async function createShowtimes(service: ShowtimesService, createDtos: ShowtimeCreateDto[]) {
    const { success } = await service.createShowtimes(createDtos)
    expect(success).toBeTruthy()

    const showtimes = await service.findAllShowtimes({
        startTimeRange: { start: new Date(0), end: new Date('9999') }
    })
    return showtimes
}
