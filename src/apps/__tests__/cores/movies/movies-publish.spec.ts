import type { MovieDto } from 'apps/cores'
import { Errors } from 'apps/__tests__/__helpers__'
import { MovieGenre, MovieRating } from 'apps/cores'
import { nullObjectId } from 'testlib'
import type { MoviesPublishFixture } from './movies-publish.fixture'
import { createUnpublishedMovie } from './movies-publish.fixture'

describe('MoviesPublish', () => {
    let fix: MoviesPublishFixture

    beforeEach(async () => {
        const { createMoviesPublishFixture } = await import('./movies-publish.fixture')
        fix = await createMoviesPublishFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movies/:movieId/publish', () => {
        // 미발행 영화가 존재할 때
        describe('when an unpublished movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
            })

            // 필수 필드가 준비되었을 때
            describe('when required fields are ready', () => {
                const updateDto = {
                    director: 'Quentin Tarantino',
                    durationInSeconds: 90 * 60,
                    genres: [MovieGenre.Action],
                    plot: `MoviePlot`,
                    rating: MovieRating.PG,
                    releaseDate: new Date(0),
                    title: `MovieTitle`
                }

                beforeEach(async () => {
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

                // 공개 후 영화를 검색한다
                it('finds the movie after publishing', async () => {
                    const { body: publishedMovie } = await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .ok()

                    const moviePage = await fix.moviesClient.searchPage({ title: `MovieTitle` })
                    expect(moviePage.items[0]).toEqual(publishedMovie)
                })

                // 공개 전에는 검색되지 않는다
                it('does not find the movie before publishing', async () => {
                    const moviePage = await fix.moviesClient.searchPage({ title: `MovieTitle` })
                    expect(moviePage.items).toHaveLength(0)
                })
            })

            // 필수 필드가 누락되었을 때
            describe('when required fields are missing', () => {
                // 422 Unprocessable Entity를 반환한다
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .unprocessableEntity(
                            Errors.Movies.InvalidForPublish(expect.any(Array))
                        )
                })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movies/${nullObjectId}/publish`)
                    .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
            })
        })
    })
})
