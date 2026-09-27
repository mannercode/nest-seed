import type { MockInstance } from 'vitest'
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
        describe('필수 정보가 모두 채워진 미공개 영화가 존재하면', () => {
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

        describe('필수 정보가 비어 있는 미공개 영화가 있으면', () => {
            let movie: MovieDto
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
            })
            it('공개 요청에 422를 반환한다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/publish`)
                    .unprocessableEntity({
                        expected: Errors.Movies.InvalidForPublish(expect.any(Array))
                    })
            })
        })

        describe('감독 정보만 비어 있는 미공개 영화가 있으면', () => {
            let movie: MovieDto
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)

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
            })
            it('공개 요청에 director만 누락 필드로 담은 422를 반환한다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/publish`)
                    .unprocessableEntity({
                        expected: Errors.Movies.InvalidForPublish(['director'])
                    })
            })
        })

        it('영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .post(`/movies/${nullObjectId}/publish`)
                .notFound({ expected: Errors.Mongo.DocumentNotFound(nullObjectId) })
        })
    })

    describe('공개된 영화가 존재하면', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix)
        })

        it.each([
            ['genres', { genres: [] }],
            ['durationInSeconds', { durationInSeconds: 0 }],
            ['rating', { rating: MovieRating.Unrated }],
            ['releaseDate', { releaseDate: MovieDefaults.releaseDate }],
            ['director', { director: '' }],
            ['plot', { plot: '' }],
            ['title', { title: '' }]
        ])('%s 값을 비우는 수정에 422를 반환하고 기존 값을 유지한다', async (field, update) => {
            await fix.httpClient
                .patch(`/movies/${movie.id}`)
                .body(update)
                .unprocessableEntity({ expected: Errors.Movies.InvalidForPublish([field]) })

            await fix.httpClient
                .get(`/movies/${movie.id}`)
                .ok({ schema: MovieSchema, expected: movie })
        })
    })

    describe('MoviesService.update', () => {
        describe('미공개 영화가 존재하면', () => {
            let moviesService: MoviesService
            let movie: MovieDto

            beforeEach(async () => {
                moviesService = fix.module.get(MoviesService)
                movie = await createUnpublishedMovie(fix)
            })

            it.each([
                { field: 'genres', update: { genres: null } },
                { field: 'rating', update: { rating: null } },
                { field: 'releaseDate', update: { releaseDate: null } }
            ])('$field를 null로 수정하면 예외를 던진다', async ({ update }) => {
                // @ts-expect-error 런타임 호출이 타입 계약을 어긴 경우를 검증한다.
                await expect(moviesService.update(movie.id, update)).rejects.toThrow()
            })
        })
    })

    describe('공개된 영화의 첫 저장이 충돌하도록 설정하면', () => {
        let moviesService: MoviesService
        let movie: MovieDto
        let update: MockInstance<MoviesRepository['collection']['findOneAndUpdate']>
        beforeEach(async () => {
            moviesService = fix.module.get(MoviesService)
            const repository = fix.module.get(MoviesRepository)
            movie = await createMovie(fix)
            update = vi.spyOn(repository.collection, 'findOneAndUpdate').mockResolvedValueOnce(null)
        })
        it('수정을 재시도해 저장하고 수정된 영화를 반환한다', async () => {
            await expect(
                moviesService.update(movie.id, { title: 'retried title' })
            ).resolves.toEqual(expect.objectContaining({ title: 'retried title' }))
            expect(update).toHaveBeenCalledTimes(2)
        })
    })

    describe('수정 내용을 저장하기 직전에 다른 요청이 영화를 공개하도록 설정하면', () => {
        let movie: MovieDto
        beforeEach(async () => {
            const moviesService = fix.module.get(MoviesService)
            const repository = fix.module.get(MoviesRepository)
            movie = await moviesService.create(buildCreateMovieDto())
            const save = repository.update.bind(repository)
            vi.spyOn(repository, 'update').mockImplementationOnce(async (...args) => {
                await moviesService.publish(movie.id)
                return save(...args)
            })
        })
        it('필수 정보를 비우는 수정에 422를 반환하고 공개된 값을 유지한다', async () => {
            await fix.httpClient
                .patch(`/movies/${movie.id}`)
                .body({ genres: [] })
                .unprocessableEntity({ expected: Errors.Movies.InvalidForPublish(['genres']) })

            await fix.httpClient
                .get(`/movies/${movie.id}`)
                .ok({ schema: MovieSchema, expected: movie })
        })
    })

    describe('공개된 영화의 저장이 계속 충돌하도록 설정하면', () => {
        let movie: MovieDto
        let update: MockInstance<MoviesRepository['collection']['findOneAndUpdate']>
        beforeEach(async () => {
            const repository = fix.module.get(MoviesRepository)
            movie = await createMovie(fix)
            update = vi.spyOn(repository.collection, 'findOneAndUpdate').mockResolvedValue(null)
        })
        it('수정을 다섯 번 시도한 뒤 409를 반환한다', async () => {
            await fix.httpClient
                .patch(`/movies/${movie.id}`)
                .body({ title: 'never written' })
                .conflict({ expected: Errors.Movies.UpdateConflict(movie.id) })

            expect(update).toHaveBeenCalledTimes(5)
        })
    })
})
