import { addMinutes } from 'common'
import { omit } from 'lodash'
import { MovieDto } from 'services/movies'
import { ShowtimeCreationDto, ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { TheaterDto } from 'services/theaters'
import { HttpTestContext, createHttpTestContext } from 'testlib'
import { AppModule } from '../app.module'
import { createMovie } from './movies.fixture'
import { createShowtimes } from './showtimes.fixture'
import { createTheater } from './theaters.fixture'

export interface IsolatedFixture {
    testContext: HttpTestContext
    service: ShowtimesService
    movie: MovieDto
    theater: TheaterDto
    showtimes: ShowtimeDto[]
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] })
    const service = testContext.module.get(ShowtimesService)
    const movie = await createMovie(testContext.client)
    const theater = await createTheater(testContext.client)
    const { creationDtos } = createShowtimeDtos({
        movieId: movie.id,
        theaterId: theater.id
    })
    const showtimes = await createShowtimes(service, creationDtos)
    return { testContext, service, movie, theater, showtimes }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const createShowtimeDtos = (overrides = {}, length: number = 100) => {
    const creationDtos: ShowtimeCreationDto[] = []
    const expectedDtos: ShowtimeDto[] = []

    const now = new Date()

    for (let i = 0; i < length; i++) {
        const creationDto = {
            batchId: '000000000000000000000001',
            movieId: '000000000000000000000002',
            theaterId: '000000000000000000000003',
            startTime: addMinutes(now, i * 120),
            endTime: addMinutes(now, i * 120 + 90),
            ...overrides
        }

        const expectedDto = { id: expect.anything(), ...omit(creationDto, 'batchId') }

        creationDtos.push(creationDto)
        expectedDtos.push(expectedDto)
    }

    return { creationDtos, expectedDtos }
}
