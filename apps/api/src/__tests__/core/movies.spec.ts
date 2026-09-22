import { Checksum, ensure, paginationResultSchema } from '@mannercode/common'
import { nullObjectId, plainDate } from '@mannercode/testing'
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
    createShowtimes,
    createUnpublishedMovie,
    Errors,
    testAssets,
    uploadAndFinalizeMovieAsset,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { AdminAuthGuard } from '#gateway'

describe('MoviesService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
        teardown = fix.teardown
    })
    afterEach(() => teardown?.())

    describe('POST /movies', () => {
        it.each([
            { durationInSeconds: '90' },
            { title: true },
            { releaseDate: null },
            { assetIds: [nullObjectId] }
        ])('본문의 잘못된 필드 %j는 400을 반환한다', async (invalid) => {
            await fix.httpClient.post('/movies').body(invalid).badRequest()
        })

        it('생성된 영화를 반환한다', async () => {
            const createDto = buildCreateMovieDto()

            const response = await fix.httpClient
                .post('/movies')
                .body(createDto)
                .created({
                    schema: MovieSchema,
                    expected: { ...createDto, id: expect.any(String), imageUrls: [] }
                })
            expect(response.text).toContain('"releaseDate":"1970-01-01"')
        })

        it('필드를 비워 보내면 기본값이 적용된 영화를 반환한다', async () => {
            await fix.httpClient
                .post('/movies')
                .body({})
                .created({
                    schema: MovieSchema,
                    expected: {
                        genres: [],
                        id: expect.any(String),
                        imageUrls: [],
                        ...MovieDefaults
                    }
                })
        })
    })

    describe('GET /movies/:id', () => {
        it('ID에 해당하는 영화를 반환한다', async () => {
            const movie = await createMovie(fix)

            await fix.httpClient
                .get(`/movies/${movie.id}`)
                .ok({ schema: MovieSchema, expected: movie })
        })

        describe('이미지가 있을 때', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
                await uploadAndFinalizeMovieAsset(fix, movie.id)
            })

            it('imageUrls로 이미지를 다운로드할 수 있다', async () => {
                const { body } = await fix.httpClient
                    .get(`/movies/${movie.id}`)
                    .ok({ schema: MovieSchema })

                const response = await fetch(ensure(body.imageUrls[0]))
                expect(response.ok).toBe(true)

                const buffer = Buffer.from(await response.bytes())
                expect(testAssets.image.checksum).toEqual(Checksum.fromBuffer(buffer))
            })
        })

        it('ID에 해당하는 영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/movies/${nullObjectId}`)
                .notFound({ expected: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId]) })
        })

        it('미공개(draft) 영화면 404를 반환한다', async () => {
            const draft = await createUnpublishedMovie(fix)

            await fix.httpClient
                .get(`/movies/${draft.id}`)
                .notFound({ expected: Errors.Movies.NotFound(draft.id) })
        })
    })

    describe('PATCH /movies/:id', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix, { title: 'original-title' })
        })

        it('수정된 영화를 반환한다', async () => {
            const updateDto = {
                director: 'Steven Spielberg',
                durationInSeconds: 10 * 60,
                genres: ['romance', 'thriller'],
                plot: 'new plot',
                rating: 'R',
                releaseDate: plainDate('2000-01-01')
            }

            await fix.httpClient
                .patch(`/movies/${movie.id}`)
                .body(updateDto)
                .ok({ schema: MovieSchema, expected: { ...movie, ...updateDto } })
        })

        it('assetIds 직접 입력은 거절하고 기존 이미지 연결을 유지한다', async () => {
            await uploadAndFinalizeMovieAsset(fix, movie.id)
            const { body: before } = await fix.httpClient
                .get(`/movies/${movie.id}`)
                .ok({ schema: MovieSchema })
            await fix.httpClient.patch(`/movies/${movie.id}`).body({ assetIds: [] }).badRequest()
            await fix.httpClient
                .get(`/movies/${movie.id}`)
                .ok({ schema: MovieSchema, expected: before })
        })

        it('수정 내용이 DB에 저장된다', async () => {
            const updateDto = { title: 'update title' }
            await fix.httpClient
                .patch(`/movies/${movie.id}`)
                .body(updateDto)
                .ok({ schema: MovieSchema })

            await fix.httpClient
                .get(`/movies/${movie.id}`)
                .ok({ schema: MovieSchema, expected: { ...movie, ...updateDto } })
        })

        it('ID에 해당하는 영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .patch(`/movies/${nullObjectId}`)
                .body({})
                .notFound({ expected: Errors.Mongo.DocumentNotFound(nullObjectId) })
        })
    })

    describe('DELETE /movies/:id', () => {
        it('204를 반환하고 삭제 후 조회에는 404를 반환한다', async () => {
            const movie = await createMovie(fix)

            await fix.httpClient.delete(`/movies/${movie.id}`).noContent()

            await fix.httpClient
                .get(`/movies/${movie.id}`)
                .notFound({ expected: Errors.Mongo.MultipleDocumentsNotFound([movie.id]) })
        })

        it('상영이 참조하는 영화는 삭제할 수 없다', async () => {
            const movie = await createMovie(fix)
            await createShowtimes(fix, [{ movieId: movie.id }])

            await fix.httpClient
                .delete(`/movies/${movie.id}`)
                .conflict({ expected: Errors.Movies.DeleteBlockedByShowtimes(movie.id) })
        })

        describe('이미지가 있는 영화를 삭제할 때', () => {
            let movie: MovieDto

            beforeEach(async () => {
                const createdMovie = await createMovie(fix)
                await uploadAndFinalizeMovieAsset(fix, createdMovie.id)

                const moviesService = fix.module.get(MoviesService)
                movie = ensure((await moviesService.getMany([createdMovie.id]))[0])
            })

            it('204를 반환하고 이미지 URL을 무효화한다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()

                const response = await fetch(ensure(movie.imageUrls[0]))
                expect(response.status).toBe(404)
            })
        })

        it('영화가 없어도 204를 반환한다', async () => {
            await fix.httpClient.delete(`/movies/${nullObjectId}`).noContent()
        })
    })

    describe('GET /movies', () => {
        let movieA1: MovieDto
        let movieA2: MovieDto
        let movieB1: MovieDto
        let movieB2: MovieDto

        beforeEach(async () => {
            const createdMovies = await Promise.all([
                createMovie(fix, {
                    director: 'James Cameron',
                    genres: [MovieGenre.Action, MovieGenre.Comedy],
                    plot: 'plot-a1',
                    rating: MovieRating.NC17,
                    releaseDate: plainDate('2000-01-01'),
                    title: 'title-a1'
                }),
                createMovie(fix, {
                    director: 'Steven Spielberg',
                    genres: [MovieGenre.Romance, MovieGenre.Drama],
                    plot: 'plot-a2',
                    rating: MovieRating.NC17,
                    releaseDate: plainDate('2000-01-02'),
                    title: 'title-a2'
                }),
                createMovie(fix, {
                    director: 'James Cameron',
                    genres: [MovieGenre.Drama, MovieGenre.Comedy],
                    plot: 'plot-b1',
                    rating: MovieRating.PG,
                    releaseDate: plainDate('2000-01-02'),
                    title: 'title-b1'
                }),
                createMovie(fix, {
                    director: 'Steven Spielberg',
                    genres: [MovieGenre.Thriller, MovieGenre.Western],
                    plot: 'plot-b2',
                    rating: MovieRating.R,
                    releaseDate: plainDate('2000-01-03'),
                    title: 'title-b2'
                })
            ])

            movieA1 = createdMovies[0]
            await uploadAndFinalizeMovieAsset(fix, movieA1.id)
            movieA2 = createdMovies[1]
            movieB1 = createdMovies[2]
            movieB2 = createdMovies[3]
        })

        const buildExpectedPage = (movies: MovieDto[]) => {
            const expectedItems = movies.map((movie) => ({
                ...movie,
                imageUrls: movie.id === movieA1.id ? [expect.any(String)] : []
            }))
            return {
                items: expect.arrayContaining(expectedItems),
                page: expect.any(Number),
                size: expect.any(Number),
                total: movies.length
            }
        }

        it('쿼리가 없으면 전체 영화 페이지를 반환한다', async () => {
            const expected = buildExpectedPage([movieA1, movieA2, movieB1, movieB2])

            await fix.httpClient
                .get('/movies')
                .ok({ schema: paginationResultSchema(MovieSchema), expected })
        })

        it('title 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ title: 'title-a' })
                .ok({
                    schema: paginationResultSchema(MovieSchema),
                    expected: buildExpectedPage([movieA1, movieA2])
                })
        })

        it('genre로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ genre: MovieGenre.Drama })
                .ok({
                    schema: paginationResultSchema(MovieSchema),
                    expected: buildExpectedPage([movieA2, movieB1])
                })
        })

        it('개봉일로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ releaseDate: plainDate('2000-01-02').toString() })
                .ok({
                    schema: paginationResultSchema(MovieSchema),
                    expected: buildExpectedPage([movieA2, movieB1])
                })
        })

        it('plot 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ plot: 'plot-b' })
                .ok({
                    schema: paginationResultSchema(MovieSchema),
                    expected: buildExpectedPage([movieB1, movieB2])
                })
        })

        it('director 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ director: 'James' })
                .ok({
                    schema: paginationResultSchema(MovieSchema),
                    expected: buildExpectedPage([movieA1, movieB1])
                })
        })

        it('rating으로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ rating: MovieRating.NC17 })
                .ok({
                    schema: paginationResultSchema(MovieSchema),
                    expected: buildExpectedPage([movieA1, movieA2])
                })
        })

        it('알 수 없는 쿼리 파라미터는 400을 반환한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ wrong: 'value' })
                .badRequest({ expected: Errors.RequestValidation.Failed(expect.any(Array)) })
        })
    })
})
