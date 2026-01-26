import { MovieGenre, MovieRating } from 'apps/cores'
import { nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import { createMovie, uploadCompleteMovieAsset } from './movies-publish.fixture'
import type { MoviesPublishFixture } from './movies-publish.fixture'
import type { MovieDto } from 'apps/cores'

describe('MoviesPublish', () => {
    let fix: MoviesPublishFixture

    beforeEach(async () => {
        const { createMoviesPublishFixture } = await import('./movies-publish.fixture')
        fix = await createMoviesPublishFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movies/:movieId/publish', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 유효한 상태인 경우
            describe('when required fields are ready', () => {
                const updateDto = {
                    title: `MovieTitle`,
                    genres: [MovieGenre.Action],
                    releaseDate: new Date(0),
                    plot: `MoviePlot`,
                    durationInSeconds: 90 * 60,
                    director: 'Quentin Tarantino',
                    rating: MovieRating.PG
                }

                beforeEach(async () => {
                    await uploadCompleteMovieAsset(fix, movie.id)
                    await fix.httpClient.patch(`/movies/${movie.id}`).body(updateDto).ok()
                })

                // 공개된 영화를 반환한다
                it('returns the published movie', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .ok(
                            expect.objectContaining({
                                id: expect.any(String),
                                ...updateDto,
                                imageUrls: expect.any(Array)
                            })
                        )
                })

                // 영화를 공개한다
                it('publishes the movie', async () => {
                    const { body: publishedMovie } = await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .ok()

                    await fix.httpClient
                        .get(`/movies/${publishedMovie.id}`)
                        .ok({ ...publishedMovie, imageUrls: expect.any(Array) })
                })
            })

            // 필수 필드가 누락된 경우
            describe('when required fields are missing', () => {
                beforeEach(async () => {
                    await uploadCompleteMovieAsset(fix, movie.id)
                })

                // 422 Unprocessable Entity를 반환한다
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .unprocessableEntity({
                            ...Errors.Movies.InvalidForCompletion,
                            missingFields: expect.any(Array)
                        })
                })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movies/${nullObjectId}/publish`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })
})
