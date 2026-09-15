import { paginationResultSchema } from '@mannercode/common'
import { nullObjectId, nullPlainDate } from '@mannercode/testing'
import {
    MovieDefaults,
    MovieGenre,
    MovieRating,
    type MovieDto,
    MoviesService,
    MovieSchema
} from '#core'
import {
    buildCreateMovieDto,
    createMovie,
    createUnpublishedMovie,
    Errors,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { AdminAuthGuard } from '#gateway'
import { MoviesRepository } from '../../services/core/movies/movies.repository.js'

describe('MoviesPublish', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
        teardown = fix.teardown
    })
    afterEach(() => teardown?.())

    describe('POST /movies/:movieId/publish', () => {
        describe('미발행 영화에 필수 필드가 모두 채워졌을 때', () => {
            let movie: MovieDto
            const updateDto = {
                director: 'Quentin Tarantino',
                durationInSeconds: 90 * 60,
                genres: [MovieGenre.Action],
                plot: `MoviePlot`,
                rating: MovieRating.PG,
                releaseDate: nullPlainDate,
                title: `MovieTitle`
            }

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                await fix.httpClient
                    .patch(`/movies/${movie.id}`)
                    .body(updateDto)
                    .ok({ schema: MovieSchema })
            })

            it('공개된 영화를 반환한다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/publish`)
                    .ok({
                        schema: MovieSchema,
                        expected: expect.objectContaining({
                            id: expect.any(String),
                            ...updateDto,
                            imageUrls: expect.any(Array)
                        })
                    })
            })

            it('공개된 영화는 검색에서 노출된다', async () => {
                const { body: publishedMovie } = await fix.httpClient
                    .post(`/movies/${movie.id}/publish`)
                    .ok({ schema: MovieSchema })

                const { body: moviePage } = await fix.httpClient
                    .get('/movies')
                    .query({ title: 'MovieTitle' })
                    .ok({ schema: paginationResultSchema(MovieSchema) })
                expect(moviePage.items[0]).toEqual(publishedMovie)
            })

            it('공개 전에는 검색에서 노출되지 않는다', async () => {
                const { body: moviePage } = await fix.httpClient
                    .get('/movies')
                    .query({ title: 'MovieTitle' })
                    .ok({ schema: paginationResultSchema(MovieSchema) })
                expect(moviePage.items).toHaveLength(0)
            })
        })

        it('미발행 영화의 필수 필드가 누락되어 있으면 422를 반환한다', async () => {
            const movie = await createUnpublishedMovie(fix)

            await fix.httpClient
                .post(`/movies/${movie.id}/publish`)
                .unprocessableEntity({
                    expected: Errors.Movies.InvalidForPublish(expect.any(Array))
                })
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
                    releaseDate: nullPlainDate,
                    title: `MovieTitle`
                })
                .ok({ schema: MovieSchema })

            await fix.httpClient
                .post(`/movies/${movie.id}/publish`)
                .unprocessableEntity({ expected: Errors.Movies.InvalidForPublish(['director']) })
        })

        it('영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .post(`/movies/${nullObjectId}/publish`)
                .notFound({ expected: Errors.Mongo.DocumentNotFound(nullObjectId) })
        })
    })

    it.each([
        ['genres', { genres: [] }],
        ['durationInSeconds', { durationInSeconds: 0 }],
        ['rating', { rating: MovieRating.Unrated }],
        ['releaseDate', { releaseDate: MovieDefaults.releaseDate }],
        ['director', { director: '' }],
        ['plot', { plot: '' }],
        ['title', { title: '' }]
    ])('공개된 영화의 %s 필수값을 비우면 422를 반환하고 저장하지 않는다', async (field, update) => {
        const movie = await createMovie(fix)

        await fix.httpClient
            .patch(`/movies/${movie.id}`)
            .body(update)
            .unprocessableEntity({ expected: Errors.Movies.InvalidForPublish([field]) })

        await fix.httpClient.get(`/movies/${movie.id}`).ok({ schema: MovieSchema, expected: movie })
    })

    it('공개 여부와 무관하게 저장 타입을 깨뜨리는 null 수정은 거부한다', async () => {
        const moviesService = fix.module.get(MoviesService)
        const movie = await createUnpublishedMovie(fix)

        for (const update of [{ genres: null }, { rating: null }, { releaseDate: null }]) {
            // @ts-expect-error 런타임 호출이 타입 계약을 어긴 경우를 검증한다.
            await expect(moviesService.update(movie.id, update)).rejects.toThrow()
        }
    })

    it('동시 갱신으로 CAS가 한 번 빗나가면 최신 문서를 다시 읽어 갱신한다', async () => {
        const moviesService = fix.module.get(MoviesService)
        const repository = fix.module.get(MoviesRepository)
        const movie = await createMovie(fix)
        const update = vi
            .spyOn(repository.collection, 'findOneAndUpdate')
            .mockResolvedValueOnce(null)

        await expect(moviesService.update(movie.id, { title: 'retried title' })).resolves.toEqual(
            expect.objectContaining({ title: 'retried title' })
        )
        expect(update).toHaveBeenCalledTimes(2)
    })

    it('초안 수정 중 영화가 공개되면 최신 공개 조건을 다시 검증해 422를 반환한다', async () => {
        const moviesService = fix.module.get(MoviesService)
        const repository = fix.module.get(MoviesRepository)
        const movie = await moviesService.create(buildCreateMovieDto())
        const save = repository.update.bind(repository)
        vi.spyOn(repository, 'update').mockImplementationOnce(async (...args) => {
            await moviesService.publish(movie.id)
            return save(...args)
        })

        await fix.httpClient
            .patch(`/movies/${movie.id}`)
            .body({ genres: [] })
            .unprocessableEntity({ expected: Errors.Movies.InvalidForPublish(['genres']) })

        await fix.httpClient.get(`/movies/${movie.id}`).ok({ schema: MovieSchema, expected: movie })
    })

    it('CAS가 반복해서 빗나가면 정해진 횟수 뒤 409를 반환한다', async () => {
        const repository = fix.module.get(MoviesRepository)
        const movie = await createMovie(fix)
        const update = vi.spyOn(repository.collection, 'findOneAndUpdate').mockResolvedValue(null)

        await fix.httpClient
            .patch(`/movies/${movie.id}`)
            .body({ title: 'never written' })
            .conflict({ expected: Errors.Movies.UpdateConflict(movie.id) })

        expect(update).toHaveBeenCalledTimes(5)
    })
})
