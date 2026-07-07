import { nullObjectId } from '@mannercode/testing'
import { MovieGenre, MovieRating, type MovieDto } from 'core'
import { createUnpublishedMovie, Errors, type AppTestContext } from '../helpers'

describe('MoviesPublish', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { AdminAuthGuard } = await import('gateway')
        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
    })
    afterEach(() => fix.teardown())

    describe('POST /movies/:movieId/publish', () => {
        describe('미발행 영화에 필수 필드가 모두 채워졌을 때', () => {
            let movie: MovieDto
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
                movie = await createUnpublishedMovie(fix)
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

            it('공개된 영화는 검색에서 노출된다', async () => {
                const { body: publishedMovie } = await fix.httpClient
                    .post(`/movies/${movie.id}/publish`)
                    .ok()

                const { body: moviePage } = await fix.httpClient
                    .get('/movies')
                    .query({ title: 'MovieTitle' })
                    .ok()
                expect(moviePage.items[0]).toEqual(publishedMovie)
            })

            it('공개 전에는 검색에서 노출되지 않는다', async () => {
                const { body: moviePage } = await fix.httpClient
                    .get('/movies')
                    .query({ title: 'MovieTitle' })
                    .ok()
                expect(moviePage.items).toHaveLength(0)
            })
        })

        it('미발행 영화의 필수 필드가 누락되어 있으면 422를 반환한다', async () => {
            const movie = await createUnpublishedMovie(fix)

            await fix.httpClient
                .post(`/movies/${movie.id}/publish`)
                .unprocessableEntity(Errors.Movies.InvalidForPublish(expect.any(Array)))
        })

        it('영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .post(`/movies/${nullObjectId}/publish`)
                .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
        })
    })
})
