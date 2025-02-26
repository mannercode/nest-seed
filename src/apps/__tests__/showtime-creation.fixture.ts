import { DateUtil, jsonToObject } from 'common'
import {
    MovieDto,
    MoviesService,
    ShowtimeCreateDto,
    ShowtimesService,
    TheaterDto,
    TheatersService
} from 'cores'
import { HttpTestClient, nullObjectId } from 'testlib'
import { createMovie } from './movies.fixture'
import { createTheater } from './theaters.fixture'
import { AllTestContexts, createAllTestContexts } from './utils'

export interface Fixture {
    testContext: AllTestContexts
    showtimesService: ShowtimesService
    movie: MovieDto
    theater: TheaterDto
}

export async function createFixture() {
    const testContext = await createAllTestContexts()
    const module = testContext.coresContext.module

    const showtimesService = module.get(ShowtimesService)
    const moviesService = module.get(MoviesService)
    const movie = await createMovie(moviesService)
    const theatersService = module.get(TheatersService)
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
            endTime: DateUtil.addMinutes(startTime, 90),
            ...overrides
        }

        createDtos.push(createDto)
    })

    return createDtos
}

export const monitorEvents = (client: HttpTestClient, waitStatuses: string[]) => {
    return new Promise((resolve, reject) => {
        client.get('/showtime-creation/events').sse((data) => {
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
