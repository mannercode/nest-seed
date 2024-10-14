import { ShowtimesService } from 'services/showtimes'
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

export const generateShowtimeCreationDtos = (overrides = {}) => {
    const createDto = {
        movieId: movie.id,
        theaterIds: pickIds(theaters),
        durationMinutes: 1,
        startTimes: [new Date(0)],
        ...overrides
    } as CreateShowtimesDto

    if (!createDto.movieId || !createDto.theaterIds)
        throw new Error('movie or theaters is not defined')

    const expectedDtos = createDto.theaterIds.flatMap((theaterId) =>
        createDto.startTimes.map(
            (startTime) =>
                ({
                    id: expect.anything(),
                    movieId: createDto.movieId,
                    theaterId,
                    startTime,
                    endTime: addMinutes(startTime, createDto.durationMinutes)
                }) as ShowtimeDto
        )
    )

    return { creationDtos, expectedDtos }
}
