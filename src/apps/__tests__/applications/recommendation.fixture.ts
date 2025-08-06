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
import { StorageFilesModule } from 'apps/infrastructures'
import {
    createCustomerAndLogin2,
    createMovie2,
    createShowtimes2,
    createTestFixture,
    createWatchRecord2,
    TestFixture
} from '../__helpers__'

export const createWatchedMovies = async (ctx: TestFixture, dtos: Partial<MovieDto>[]) => {
    const movies = await Promise.all(dtos.map((dto) => createMovie2(ctx, dto)))

    const { customer, accessToken } = await createCustomerAndLogin2(ctx)

    const watchRecords = await Promise.all(
        movies.map((movie) =>
            createWatchRecord2(ctx, { customerId: customer.id, movieId: movie.id })
        )
    )

    return { customer, accessToken, movies, watchRecords }
}

export const createShowingMovies = async (ctx: TestFixture, dtos: Partial<MovieDto>[]) => {
    const movies = await Promise.all(dtos.map((dto) => createMovie2(ctx, dto)))

    const createShowtimesDtos = movies.map((movie) => ({
        movieId: movie.id,
        startTime: new Date('2999-01-01')
    }))

    const showtimes = await createShowtimes2(ctx, createShowtimesDtos)

    return { movies, showtimes }
}

export type Fixture = TestFixture

export const createFixture = async (): Promise<Fixture> => {
    const fix = await createTestFixture({
        imports: [
            MoviesModule,
            StorageFilesModule,
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
            WatchRecordsClient
        ],
        controllers: [MoviesController]
    })

    return { ...fix }
}
