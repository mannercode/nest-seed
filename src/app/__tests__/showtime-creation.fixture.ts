import { addMinutes, convertStringToDate, jsonToObject, nullObjectId } from 'common'
import { MovieDto } from 'services/movies'
import { ShowtimeCreationDto, ShowtimesService } from 'services/showtimes'
import { TheaterDto } from 'services/theaters'
import { createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { AppModule } from '../app.module'
import { createMovie } from './movies.fixture'
import { createTheater } from './theaters.fixture'

export interface IsolatedFixture {
    testContext: HttpTestContext
    showtimesService: ShowtimesService
    movie: MovieDto
    theater: TheaterDto
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] })
    const showtimesService = testContext.module.get(ShowtimesService)
    const movie = await createMovie(testContext.client)
    const theater = await createTheater(testContext.client)

    return { testContext, showtimesService, movie, theater }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const createShowtimeDtos = (startTimeStrs: string[], overrides = {}) => {
    const creationDtos: ShowtimeCreationDto[] = []

    startTimeStrs.map((timeString) => {
        const startTime = convertStringToDate(timeString)

        const creationDto = {
            batchId: nullObjectId,
            movieId: nullObjectId,
            theaterId: nullObjectId,
            startTime,
            endTime: addMinutes(startTime, 90),
            ...overrides
        }

        creationDtos.push(creationDto)
    })

    return creationDtos
}

export const monitorEvents = (client: HttpTestClient, waitStatuses: string[]) => {
    return new Promise((resolve, reject) => {
        client.get('/showtime-creation/events').sse(async (data: any) => {
            const result = jsonToObject(JSON.parse(data))

            if (['complete', 'fail', 'error'].includes(result.status)) {
                waitStatuses.includes(result.status) ? resolve(result) : reject(result)
            } else if (!result.status) {
                reject(data)
            }
        }, reject)
    })
}

export const requestShowtimeCreation = async (
    client: HttpTestClient,
    movieId: string,
    theaterIds: string[],
    startTimes: string[],
    durationMinutes: number
) => {
    const { body } = await client
        .post('/showtime-creation/showtimes')
        .body({ movieId, theaterIds, startTimes, durationMinutes })
        .accepted()

    return body
}
