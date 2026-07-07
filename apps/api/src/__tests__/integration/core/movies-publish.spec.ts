import { nullObjectId } from '@mannercode/testing'
import { MovieGenre, MovieRating, type MovieDto } from 'core'
import { createMovie, createUnpublishedMovie, Errors, type AppTestContext } from '../helpers'

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

        it('필수 필드가 하나만 누락되어 있으면 missingFields에 그 필드만 담아 422를 반환한다', async () => {
            const movie = await createUnpublishedMovie(fix)

            // director만 기본값(미설정)으로 남겨 missingFields가 실제 누락 필드만 담는지 고정한다
            await fix.httpClient
                .patch(`/movies/${movie.id}`)
                .body({
                    durationInSeconds: 90 * 60,
                    genres: [MovieGenre.Action],
                    plot: `MoviePlot`,
                    rating: MovieRating.PG,
                    releaseDate: new Date(0),
                    title: `MovieTitle`
                })
                .ok()

            await fix.httpClient
                .post(`/movies/${movie.id}/publish`)
                .unprocessableEntity(Errors.Movies.InvalidForPublish(['director']))
        })

        it('영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .post(`/movies/${nullObjectId}/publish`)
                .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
        })
    })

    it('공개된 영화를 빈 genres로 되돌리는 수정이면 검증 오류를 던진다', async () => {
        const { MoviesService } = await import('core')
        const moviesService = fix.module.get(MoviesService)
        const movie = await createMovie(fix)

        // publish()의 사전 검사와 별개로 스키마 검증자가 공개 후 불변식을 지키는 유일한 방어선이다
        const promise = moviesService.update(movie.id, { genres: [] })

        await expect(promise).rejects.toThrow('Published movies must have at least one genre')
    })
})
