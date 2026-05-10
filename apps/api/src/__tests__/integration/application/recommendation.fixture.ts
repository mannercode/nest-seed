import type { TestContext } from '@mannercode/testing'
import type { MovieDto } from 'core'
import { DateUtil } from '@mannercode/common'
import { createAndLoginUser, createMovie, createShowtimes, createWatchRecord } from '../helpers'

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

    const { accessToken, user } = await createAndLoginUser(ctx)

    const watchRecords = await Promise.all(
        movies.map((movie) => createWatchRecord(ctx, { userId: user.id, movieId: movie.id }))
    )

    return { accessToken, user, movies, watchRecords }
}
