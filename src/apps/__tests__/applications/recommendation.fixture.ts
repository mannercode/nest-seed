import { RecommendationClient, RecommendationModule } from 'apps/applications'
import {
    CustomersClient,
    CustomersModule,
    MovieDto,
    MoviesClient,
    MoviesModule,
    ShowtimesClient,
    ShowtimesModule,
    WatchRecordsClient,
    WatchRecordsModule
} from 'apps/cores'
import { CustomerJwtStrategy, MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { TestContext } from 'testlib'
import {
    createAndLoginCustomer,
    createMovie,
    createShowtimes,
    createAppTestContext,
    createWatchRecord,
    AppTestContext
} from '../__helpers__'

export async function createWatchedMovies(ctx: TestContext, dtos: Partial<MovieDto>[]) {
    const movies = await Promise.all(dtos.map((dto) => createMovie(ctx, dto)))

    const { customer, accessToken } = await createAndLoginCustomer(ctx)

    const watchRecords = await Promise.all(
        movies.map((movie) =>
            createWatchRecord(ctx, { customerId: customer.id, movieId: movie.id })
        )
    )

    return { customer, accessToken, movies, watchRecords }
}

export async function createShowingMovies(ctx: TestContext, dtos: Partial<MovieDto>[]) {
    const movies = await Promise.all(dtos.map((dto) => createMovie(ctx, dto)))

    const createShowtimesDtos = movies.map((movie) => ({
        movieId: movie.id,
        startTime: new Date('2999-01-01')
    }))

    const showtimes = await createShowtimes(ctx, createShowtimesDtos)

    return { movies, showtimes }
}

export type RecommendationFixture = AppTestContext

export async function createRecommendationFixture(): Promise<RecommendationFixture> {
    const ctx = await createAppTestContext({
        imports: [
            MoviesModule,
            AssetsModule,
            CustomersModule,
            ShowtimesModule,
            WatchRecordsModule,
            RecommendationModule
        ],
        providers: [
            CustomerJwtStrategy,
            CustomersClient,
            MoviesClient,
            ShowtimesClient,
            RecommendationClient,
            WatchRecordsClient,
            AssetsClient
        ],
        controllers: [MoviesController]
    })

    return { ...ctx }
}
