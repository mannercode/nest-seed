import { addMinutes, jsonToObject } from 'common'
import { MoviesService, ShowtimesService, TheatersService } from 'services/cores'
import { HttpTestClient, nullObjectId } from 'testlib'
import { MovieDto, ShowtimeCreateDto, TheaterDto } from 'types'
import { createMovie } from './movies.fixture'
import { createTheater } from './theaters.fixture'
import { createTestContext, TestContext } from './utils'

export interface Fixture {
    testContext: TestContext
    showtimesService: ShowtimesService
    movie: MovieDto
    theater: TheaterDto
}

export async function createFixture() {
    const testContext = await createTestContext()
    const showtimesService = testContext.module.get(ShowtimesService)
    const moviesService = testContext.module.get(MoviesService)
    const movie = await createMovie(moviesService)
    const theatersService = testContext.module.get(TheatersService)
    const theater = await createTheater(theatersService)

    return { testContext, showtimesService, movie, theater }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createShowtimeDtos = (startTimes: Date[], overrides = {}) => {
    const createDtos: ShowtimeCreateDto[] = []

    startTimes.map((startTime) => {
        const createDto = {
            batchId: nullObjectId,
            movieId: nullObjectId,
            theaterId: nullObjectId,
            startTime,
            endTime: addMinutes(startTime, 90),
            ...overrides
        }

        createDtos.push(createDto)
    })

    return createDtos
}

export const monitorEvents = (client: HttpTestClient, waitStatuses: string[]) => {
    return new Promise((resolve, reject) => {
        client.get('/showtime-creation/events').sse(async (data: any) => {
            const result = jsonToObject(JSON.parse(data))

            if (['complete', 'fail', 'error'].includes(result.status)) {
                if (waitStatuses.includes(result.status)) {
                    resolve(result)
                } else {
                    reject(result)
                }
            } else if (!result.status) {
                reject(data)
            }
        }, reject)
    })
}
