import { nullObjectId, nullPlainDate } from '@mannercode/testing'
import { MovieDefaults, MovieGenre, MovieRating, type MovieDto, MoviesService } from '#core'
import {
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
                    releaseDate: nullPlainDate,
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
                .notFound(Errors.Mongo.DocumentNotFound(nullObjectId))
        })
    })

    it('공개된 영화를 빈 genres로 되돌리는 수정이면 검증 오류를 던진다', async () => {
        const moviesService = fix.module.get(MoviesService)
        const movie = await createMovie(fix)

        // publish()의 사전 검사와 별개로 저장소 경계가 공개 후 불변식을 지키는 최종 방어선이다.
        const promise = moviesService.update(movie.id, { genres: [] })

        await expect(promise).rejects.toThrow('Published movies must have at least one genre')
    })

    it('공개된 영화의 필수값을 비우는 수정은 모두 저장소 경계에서 거부한다', async () => {
        const moviesService = fix.module.get(MoviesService)
        const movie = await createMovie(fix)
        const invalidUpdates = [
            [
                { durationInSeconds: 0 },
                'Published movies must have a duration of at least 1 second'
            ],
            [{ rating: MovieRating.Unrated }, 'Published movies cannot be unrated'],
            [
                { releaseDate: MovieDefaults.releaseDate },
                'Published movies must have a release date'
            ],
            [{ director: '' }, 'Published movies must have director'],
            [{ plot: '' }, 'Published movies must have plot'],
            [{ title: '' }, 'Published movies must have title']
        ] as const

        for (const [update, message] of invalidUpdates) {
            await expect(moviesService.update(movie.id, update)).rejects.toThrow(message)
        }
    })

    it('공개 여부와 무관하게 저장 타입을 깨뜨리는 null 수정은 거부한다', async () => {
        const moviesService = fix.module.get(MoviesService)
        const movie = await createUnpublishedMovie(fix)

        for (const update of [{ genres: null }, { rating: null }, { releaseDate: null }]) {
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

    it('CAS가 반복해서 빗나가면 정해진 횟수 뒤 명시적으로 실패한다', async () => {
        const moviesService = fix.module.get(MoviesService)
        const repository = fix.module.get(MoviesRepository)
        const movie = await createMovie(fix)
        const update = vi.spyOn(repository.collection, 'findOneAndUpdate').mockResolvedValue(null)

        await expect(moviesService.update(movie.id, { title: 'never written' })).rejects.toThrow(
            'Movie update did not converge after 5 attempts'
        )
        expect(update).toHaveBeenCalledTimes(5)
    })
})
