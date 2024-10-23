import { omit } from 'lodash'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { HttpTestContext, createHttpTestContext } from 'testlib'
import { AppModule } from '../app.module'

export interface IsolatedFixture {
    testContext: HttpTestContext
    service: ShowtimesService
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] })
    const service = testContext.module.get(ShowtimesService)

    return { testContext, service }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const createShowtimeDtos = (overrides = {}, length: number = 100) => {
    const createDtos: ShowtimeCreateDto[] = []
    const expectedDtos: ShowtimeDto[] = []

    for (let i = 0; i < length; i++) {
        const createDto = {
            batchId: '000000000000000000000001',
            movieId: '000000000000000000000002',
            theaterId: '000000000000000000000003',
            startTime: new Date(2000, 0, 1, i, 0),
            endTime: new Date(2000, 0, 1, i, 90),
            ...overrides
        }

        const expectedDto = { id: expect.anything(), ...omit(createDto, 'batchId') }

        createDtos.push(createDto)
        expectedDtos.push(expectedDto)
    }

    return { createDtos, expectedDtos }
}

export async function createShowtimes(
    service: ShowtimesService,
    createDtos: ShowtimeCreateDto[]
) {
    const { success } = await service.createShowtimes(createDtos)
    expect(success).toBeTruthy()

    const showtimes = await service.findAllShowtimes({
        startTimeRange: { start: new Date(0), end: new Date('9999') }
    })
    return showtimes
}
