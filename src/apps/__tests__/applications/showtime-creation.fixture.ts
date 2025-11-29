import {
    BulkCreateShowtimesDto,
    ShowtimeCreationClient,
    ShowtimeCreationModule
} from 'apps/applications'
import {
    MovieDto,
    MoviesClient,
    MoviesModule,
    ShowtimesClient,
    ShowtimesModule,
    TheaterDto,
    TheatersClient,
    TheatersModule,
    TicketsModule
} from 'apps/cores'
import { ShowtimeCreationController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { jsonToObject } from 'common'
import { oid } from 'testlib'
import { createMovie, createTestFixture, createTheater, TestFixture } from '../__helpers__'

export const buildBulkCreateShowtimesDto = (overrides: Partial<BulkCreateShowtimesDto> = {}) => {
    const createDto = {
        movieId: oid(0x0),
        theaterIds: [oid(0x0)],
        startTimes: [new Date(0)],
        durationInMinutes: 1,
        ...overrides
    }

    return createDto
}

export const waitForCompletion = (fix: TestFixture, status: string) => {
    return new Promise((resolve, reject) => {
        fix.httpClient.get('/showtime-creation/event-stream').sse((data) => {
            try {
                const result = jsonToObject(JSON.parse(data))

                if (['succeeded', 'failed', 'error'].includes(result.status)) {
                    fix.httpClient.abort()

                    if (status === result.status) {
                        resolve(result)
                    } else {
                        reject(result)
                    }
                }
            } catch (error) {
                fix.httpClient.abort()
                reject(error)
            }
        }, reject)
    })
}

export interface Fixture extends TestFixture {
    movie: MovieDto
    theater: TheaterDto
}

export const createFixture = async (): Promise<Fixture> => {
    const fix = await createTestFixture({
        imports: [
            MoviesModule,
            AssetsModule,
            TheatersModule,
            ShowtimesModule,
            TicketsModule,
            ShowtimeCreationModule
        ],
        providers: [
            MoviesClient,
            TheatersClient,
            ShowtimesClient,
            ShowtimeCreationClient,
            AssetsClient
        ],
        controllers: [ShowtimeCreationController]
    })

    const movie = await createMovie(fix)
    const theater = await createTheater(fix)

    return { ...fix, movie, theater }
}
