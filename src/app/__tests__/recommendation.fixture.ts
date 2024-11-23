import { CustomersService } from 'services/customers'
import { MovieDto, MoviesService } from 'services/movies'
import { ShowtimesService } from 'services/showtimes'
import { WatchRecordsService } from 'services/watch-records'
import { createHttpTestContext, HttpTestContext, nullObjectId } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { createCredentials } from './customers-auth.fixture'
import { createShowtimes } from './showtimes.fixture'
import { createMovie } from './movies.fixture'

export interface Fixture {
    testContext: HttpTestContext
    moviesService: MoviesService
    watchRecordsService: WatchRecordsService
    showtimesService: ShowtimesService
    customerId: string
    accessToken: string
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const moviesService = testContext.module.get(MoviesService)
    const watchRecordsService = testContext.module.get(WatchRecordsService)
    const showtimesService = testContext.module.get(ShowtimesService)
    const customersService = testContext.module.get(CustomersService)
    const credentials = await createCredentials(customersService)
    const customerId = credentials.customerId
    const authTokens = await customersService.login(customerId, credentials.email)
    const accessToken = authTokens.accessToken

    return {
        testContext,
        moviesService,
        watchRecordsService,
        showtimesService,
        customerId,
        accessToken
    }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createWatchedMovies = async (fixture: Fixture, dtos: Partial<MovieDto>[]) => {
    const watchedMovies = await Promise.all(
        dtos.map(async (dto) => {
            const movie = await createMovie(fixture.moviesService, dto)

            fixture.watchRecordsService.createWatchRecord({
                customerId: fixture.customerId,
                purchaseId: nullObjectId,
                watchDate: new Date(0),
                movieId: movie.id
            })

            return movie
        })
    )

    return watchedMovies
}

export const createShowingMovies = async (fixture: Fixture, dtos: Partial<MovieDto>[]) => {
    const showingMovies = await Promise.all(
        dtos.map((dto) => createMovie(fixture.moviesService, dto))
    )

    const showtimesCreateDtos = showingMovies.map((movie) => ({
        movieId: movie.id,
        batchId: nullObjectId,
        theaterId: nullObjectId,
        startTime: new Date('2999-01-01'),
        endTime: new Date('2999-01-02')
    }))

    await createShowtimes(fixture.showtimesService, showtimesCreateDtos)

    return showingMovies
}
