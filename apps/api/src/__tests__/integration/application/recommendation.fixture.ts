import type { TestContext } from '@mannercode/testing'
import { DateUtil } from '@mannercode/common'
import { RecommendationModule } from 'application'
import { UsersModule, MoviesModule, ShowtimesModule, WatchRecordsModule, type MovieDto } from 'core'
import { UserJwtAuthGuard, UserOptionalJwtAuthGuard, MoviesHttpController } from 'gateway'
import { AssetsModule } from 'infrastructure'
import {
    createAndLoginUser,
    createAppTestContext,
    createMovie,
    createShowtimes,
    createWatchRecord,
    type AppTestContext
} from '../helpers'

export type RecommendationFixture = AppTestContext

export async function createRecommendationFixture(): Promise<RecommendationFixture> {
    return createAppTestContext({
        controllers: [MoviesHttpController],
        imports: [
            MoviesModule,
            AssetsModule,
            UsersModule,
            ShowtimesModule,
            WatchRecordsModule,
            RecommendationModule
        ],
        providers: [UserJwtAuthGuard, UserOptionalJwtAuthGuard]
    })
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

    const { accessToken, user } = await createAndLoginUser(ctx)

    const watchRecords = await Promise.all(
        movies.map((movie) => createWatchRecord(ctx, { userId: user.id, movieId: movie.id }))
    )

    return { accessToken, user, movies, watchRecords }
}
