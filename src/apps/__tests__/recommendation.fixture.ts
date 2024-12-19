import {
    CustomersService,
    MoviesService,
    ShowtimesService,
    WatchRecordsService
} from 'services/cores'
import { nullObjectId } from 'testlib'
import { CustomerDto, MovieDto } from 'types'
import { createCustomerAndLogin } from './customers-auth.fixture'
import { createMovie } from './movies.fixture'
import { createShowtimes } from './showtimes.fixture'
import { createTestContext, TestContext } from './utils'

export interface Fixture {
    testContext: TestContext
    moviesService: MoviesService
    watchRecordsService: WatchRecordsService
    showtimesService: ShowtimesService
    customer: CustomerDto
    accessToken: string
}

export async function createFixture() {
    const testContext = await createTestContext()
    const moviesService = testContext.module.get(MoviesService)
    const watchRecordsService = testContext.module.get(WatchRecordsService)
    const showtimesService = testContext.module.get(ShowtimesService)
    const customersService = testContext.module.get(CustomersService)
    const { customer, accessToken } = await createCustomerAndLogin(customersService)

    return {
        testContext,
        moviesService,
        watchRecordsService,
        showtimesService,
        customer,
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
                customerId: fixture.customer.id,
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
