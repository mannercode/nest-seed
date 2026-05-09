import { nullObjectId } from '@mannercode/testing'
import { MovieGenre, MovieRating, type MovieDto } from 'cores'
import { Errors } from '../../__helpers__'
import { createUnpublishedMovie, type MoviesPublishFixture } from './movies-publish.fixture'

describe('MoviesPublish', () => {
    let fix: MoviesPublishFixture

    beforeEach(async () => {
        const { createMoviesPublishFixture } = await import('./movies-publish.fixture')
        fix = await createMoviesPublishFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movies/:movieId/publish', () => {
        describe('미발행 영화가 존재할 때', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
            })

            describe('필수 필드가 준비되었을 때', () => {
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

                it('공개된 영화를 반환한다', async () => {
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

                it('공개 후 영화를 검색한다', async () => {
                    const { body: publishedMovie } = await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .ok()

                    const moviePage = await fix.moviesService.searchPage({ title: `MovieTitle` })
                    expect(moviePage.items[0]).toEqual(publishedMovie)
                })

                it('공개 전에는 검색되지 않는다', async () => {
                    const moviePage = await fix.moviesService.searchPage({ title: `MovieTitle` })
                    expect(moviePage.items).toHaveLength(0)
                })
            })

            describe('필수 필드가 누락되었을 때', () => {
                it('422 Unprocessable Entity를 반환한다', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .unprocessableEntity(Errors.Movies.InvalidForPublish(expect.any(Array)))
                })
            })
        })

        describe('영화가 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                await fix.httpClient
                    .post(`/movies/${nullObjectId}/publish`)
                    .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
            })
        })
    })
})
