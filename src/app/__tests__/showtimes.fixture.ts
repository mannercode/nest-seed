import { addMinutes } from 'common'
import { ShowtimeCreationDto, ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { HttpTestContext, createHttpTestContext } from 'testlib'
import { AppModule } from '../app.module'
import { omit } from 'lodash'

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

export const createShowtimeDtos = (overrides = {}) => {
    const creationDtos: ShowtimeCreationDto[] = []
    const expectedDtos: ShowtimeDto[] = []

    for (let i = 0; i < 100; i++) {
        const creationDto = {
            batchId: '000000000000000000000001',
            movieId: '000000000000000000000002',
            theaterId: '000000000000000000000003',
            startTime: new Date(2000, 0, 1, i, 0),
            endTime: new Date(2000, 0, 1, i, 90),
            ...overrides
        }

        const expectedDto = { id: expect.anything(), ...omit(creationDto, 'batchId') }

        creationDtos.push(creationDto)
        expectedDtos.push(expectedDto)
    }

    return { creationDtos, expectedDtos }
}

export async function createShowtimes(
    service: ShowtimesService,
    creationDtos: ShowtimeCreationDto[]
) {
    const { success } = await service.createShowtimes(creationDtos)
    expect(success).toBeTruthy()

    const showtimes = await service.findAllShowtimes({
        startTimeRange: { start: new Date(0), end: new Date('9999') }
    })
    return showtimes
}
