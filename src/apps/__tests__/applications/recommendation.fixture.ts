import { CustomerDto, MovieDto } from 'apps/cores'
import { nullObjectId } from 'testlib'
import {
    CommonFixture,
    createCommonFixture,
    createCustomerAndLogin,
    createMovie,
    createShowtimes,
    createWatchRecord
} from '../__helpers__'

export const createWatchedMovies = async (fix: Fixture, dtos: Partial<MovieDto>[]) => {
    const watchedMovies = await Promise.all(
        dtos.map(async (dto) => {
            const movie = await createMovie(fix, dto)
            createWatchRecord(fix, { customerId: fix.customer.id, movieId: movie.id })
            return movie
        })
    )

    return watchedMovies
}

export const createShowingMovies = async (fix: CommonFixture, dtos: Partial<MovieDto>[]) => {
    const showingMovies = await Promise.all(dtos.map((dto) => createMovie(fix, dto)))

    const createShowtimesDtos = showingMovies.map((movie) => ({
        movieId: movie.id,
        transactionId: nullObjectId,
        theaterId: nullObjectId,
        startTime: new Date('2999-01-01'),
        endTime: new Date('2999-01-02')
    }))

    await createShowtimes(fix, createShowtimesDtos)

    return showingMovies
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    customer: CustomerDto
    accessToken: string
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const { customer, accessToken } = await createCustomerAndLogin(fix)

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown, customer, accessToken }
}
