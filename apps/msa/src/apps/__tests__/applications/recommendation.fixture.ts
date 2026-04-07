import { DateUtil } from '@mannercode/common'
import { TestContext } from '@mannercode/testing'
import { RecommendationHttpModule } from 'applications'
import {
    CustomerJwtAuthGuard,
    CustomerOptionalJwtAuthGuard,
    CustomersModule,
    MovieDto,
    MoviesClient,
    MoviesModule,
    ShowtimesClient,
    ShowtimesModule,
    WatchRecordsClient,
    WatchRecordsModule
} from 'cores'
import { AssetsClient, AssetsModule } from 'infrastructures'
import {
    AppTestContext,
    createAndLoginCustomer,
    createAppTestContext,
    createMovie,
    createShowtimes,
    createWatchRecord
} from '../__helpers__'

export type RecommendationFixture = AppTestContext & {}

export async function createRecommendationFixture(): Promise<RecommendationFixture> {
    const ctx = await createAppTestContext({
        imports: [
            MoviesModule,
            AssetsModule,
            CustomersModule,
            ShowtimesModule,
            WatchRecordsModule,
            RecommendationHttpModule
        ],
        providers: [
            CustomerJwtAuthGuard,
            CustomerOptionalJwtAuthGuard,
            MoviesClient,
            ShowtimesClient,
            WatchRecordsClient,
            AssetsClient
        ]
    })

    return { ...ctx }
}

export async function createShowingMovies(ctx: TestContext, dtos: Partial<MovieDto>[]) {
    const movies = await Promise.all(dtos.map((dto) => createMovie(ctx, dto)))

    const createShowtimesDtos = movies.map((movie) => ({
        movieId: movie.id,
        startTime: DateUtil.add({ days: 1 })
    }))

    await createShowtimes(ctx, createShowtimesDtos)

    return movies
}

export async function createWatchedMovies(ctx: TestContext, dtos: Partial<MovieDto>[]) {
    const movies = await Promise.all(dtos.map((dto) => createMovie(ctx, dto)))

    const { accessToken, customer } = await createAndLoginCustomer(ctx)

    const watchRecords = await Promise.all(
        movies.map((movie) =>
            createWatchRecord(ctx, { customerId: customer.id, movieId: movie.id })
        )
    )

    return { accessToken, customer, movies, watchRecords }
}
