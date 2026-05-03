import { DateUtil } from '@mannercode/common'
import { TestContext } from '@mannercode/testing'
import { RecommendationModule } from 'applications'
import { UserJwtAuthGuard, UserOptionalJwtAuthGuard, MoviesHttpController } from 'controllers'
import { UsersModule, MoviesModule, MovieDto, ShowtimesModule, WatchRecordsModule } from 'cores'
import { AssetsModule } from 'infrastructures'
import {
    AppTestContext,
    createAndLoginUser,
    createAppTestContext,
    createMovie,
    createShowtimes,
    createWatchRecord
} from '../__helpers__'

export type RecommendationFixture = AppTestContext & {}

export async function createRecommendationFixture(): Promise<RecommendationFixture> {
    const ctx = await createAppTestContext({
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

    const { accessToken, user } = await createAndLoginUser(ctx)

    const watchRecords = await Promise.all(
        movies.map((movie) => createWatchRecord(ctx, { userId: user.id, movieId: movie.id }))
    )

    return { accessToken, user, movies, watchRecords }
}
