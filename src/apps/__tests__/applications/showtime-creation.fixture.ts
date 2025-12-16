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
import {
    createMovie,
    createAppTestContext,
    createTheater,
    AppTestContext as TestContext
} from '../__helpers__'

export type ShowtimeCreationFixture = TestContext & { movie: MovieDto; theater: TheaterDto }

export async function createShowtimeCreationFixture(): Promise<ShowtimeCreationFixture> {
    const ctx = await createAppTestContext({
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

    const movie = await createMovie(ctx)
    const theater = await createTheater(ctx)

    return { ...ctx, movie, theater }
}

export function buildBulkCreateShowtimesDto(overrides: Partial<BulkCreateShowtimesDto> = {}) {
    const createDto = {
        movieId: oid(0x0),
        theaterIds: [oid(0x0)],
        startTimes: [new Date(0)],
        durationInMinutes: 1,
        ...overrides
    }

    return createDto
}

export function waitForCompletion(ctx: TestContext, status: string) {
    return new Promise((resolve, reject) => {
        ctx.httpClient.get('/showtime-creation/event-stream').sse((data) => {
            try {
                const result = jsonToObject(JSON.parse(data))

                if (['succeeded', 'failed', 'error'].includes(result.status)) {
                    ctx.httpClient.abort()

                    if (status === result.status) {
                        resolve(result)
                    } else {
                        reject(result)
                    }
                }
            } catch (error) {
                ctx.httpClient.abort()
                reject(error)
            }
        }, reject)
    })
}
