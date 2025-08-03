import { MovieDto } from 'apps/cores'
import {
    CommonFixture,
    createCommonFixture,
    createCustomerAndLogin,
    createMovie,
    createShowtimes,
    createWatchRecord
} from '../__helpers__'

export const createWatchedMovies = async (fix: CommonFixture, dtos: Partial<MovieDto>[]) => {
    const movies = await Promise.all(dtos.map((dto) => createMovie(fix, dto)))

    const { customer, accessToken } = await createCustomerAndLogin(fix)

    const watchRecords = await Promise.all(
        movies.map((movie) =>
            createWatchRecord(fix, { customerId: customer.id, movieId: movie.id })
        )
    )

    return { customer, accessToken, movies, watchRecords }
}

export const createShowingMovies = async (fix: CommonFixture, dtos: Partial<MovieDto>[]) => {
    const movies = await Promise.all(dtos.map((dto) => createMovie(fix, dto)))

    const createShowtimesDtos = movies.map((movie) => ({
        movieId: movie.id,
        startTime: new Date('2999-01-01')
    }))

    const showtimes = await createShowtimes(fix, createShowtimesDtos)

    return { movies, showtimes }
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown }
}
