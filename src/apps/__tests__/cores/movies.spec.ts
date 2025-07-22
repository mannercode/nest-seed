import { MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { Path, pickIds } from 'common'
import { expectEqualUnsorted, nullObjectId, objectToFields } from 'testlib'
import { Errors } from '../__helpers__'
import { buildCreateMovieDto, createMovie } from '../common.fixture'
import { Fixture } from './movies.fixture'

describe('MoviesService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./movies.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /movies', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 영화를 생성하고 반환한다
            it('creates and returns the movie', async () => {
                const { createDto, expectedDto } = buildCreateMovieDto()

                const { body } = await fix.httpClient
                    .post('/movies')
                    .attachments([{ name: 'files', file: fix.image.path }])
                    .fields(objectToFields(createDto))
                    .created()

                expect(body).toEqual(expectedDto)
            })
        })

        // 필수 필드가 누락된 경우
        describe('when the required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/movies')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('PATCH /movies/:id', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 영화를 수정한다
            it('updates the movie', async () => {
                const updateDto = {
                    title: 'update title',
                    genres: ['romance', 'thriller'],
                    releaseDate: new Date('2000-01-01'),
                    plot: 'new plot',
                    durationInSeconds: 10 * 60,
                    director: 'Steven Spielberg',
                    rating: 'R'
                }
                const expected = { ...fix.movie, ...updateDto }

                await fix.httpClient.patch(`/movies/${fix.movie.id}`).body(updateDto).ok(expected)
                await fix.httpClient.get(`/movies/${fix.movie.id}`).ok(expected)
            })
        })

        // payload가 비어있는 경우
        describe('when the payload is empty', () => {
            // 원래 영화 정보를 반환한다
            it('returns the original movie', async () => {
                await fix.httpClient.patch(`/movies/${fix.movie.id}`).body({}).ok(fix.movie)
            })
        })

        // 영화가 존재하지 않는 경우
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/movies/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /movies/:id', () => {
        // 영화가 존재하는 경우
        describe('when the movie exists', () => {
            // 영화를 삭제하고 파일도 삭제한다
            it('deletes the movie and its files', async () => {
                const fileUrl = fix.movie.images[0]
                const fileId = Path.basename(fileUrl)

                await fix.httpClient.delete(`/movies/${fix.movie.id}`).ok()

                await fix.httpClient.get(`/movies/${fix.movie.id}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [fix.movie.id]
                })

                await fix.httpClient.get(fileUrl).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [fileId]
                })
            })
        })

        // 영화가 존재하지 않는 경우
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient.delete(`/movies/${nullObjectId}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })

    describe('GET /movies/:id', () => {
        // 영화가 존재하는 경우
        describe('when the movie exists', () => {
            // 영화 정보를 반환한다
            it('returns the movie', async () => {
                await fix.httpClient.get(`/movies/${fix.movie.id}`).ok(fix.movie)
            })
        })

        // 영화가 존재하지 않는 경우
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient.get(`/movies/${nullObjectId}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })

    describe('GET /movies', () => {
        let movies: MovieDto[]

        beforeEach(async () => {
            const createdMovies = await Promise.all([
                createMovie(fix, {
                    title: 'title-a1',
                    plot: 'plot-a1',
                    director: 'James Cameron',
                    releaseDate: new Date('2000-01-01'),
                    rating: MovieRating.NC17,
                    genres: [MovieGenre.Action, MovieGenre.Comedy]
                }),
                createMovie(fix, {
                    title: 'title-a2',
                    plot: 'plot-a2',
                    director: 'Steven Spielberg',
                    releaseDate: new Date('2000-01-02'),
                    rating: MovieRating.NC17,
                    genres: [MovieGenre.Romance, MovieGenre.Drama]
                }),
                createMovie(fix, {
                    title: 'title-b1',
                    plot: 'plot-b1',
                    director: 'James Cameron',
                    releaseDate: new Date('2000-01-02'),
                    rating: MovieRating.PG,
                    genres: [MovieGenre.Drama, MovieGenre.Comedy]
                }),
                createMovie(fix, {
                    title: 'title-b2',
                    plot: 'plot-b2',
                    director: 'Steven Spielberg',
                    releaseDate: new Date('2000-01-03'),
                    rating: MovieRating.R,
                    genres: [MovieGenre.Thriller, MovieGenre.Western]
                })
            ])

            movies = [...createdMovies, fix.movie]
        })

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 기본 페이지네이션으로 고객을 반환한다
            it('returns movies with default pagination', async () => {
                const { body } = await fix.httpClient.get('/movies').query({ skip: 0 }).ok()
                const { items, ...pagination } = body

                expect(pagination).toEqual({
                    skip: 0,
                    take: expect.any(Number),
                    total: movies.length
                })
                expectEqualUnsorted(items, movies)
            })
        })

        // 쿼리 파라미터가 유효한 경우
        describe('when query parameters are valid', () => {
            // 제목 일부로 영화를 필터링한다
            it('filters movies by a partial title', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ title: 'title-a' })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[1]])
            })

            // 장르로 영화를 필터링한다
            it('filters movies by genre', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ genre: MovieGenre.Drama })
                    .ok()
                expectEqualUnsorted(body.items, [movies[1], movies[2]])
            })

            // 개봉일로 영화를 필터링한다
            it('filters movies by release date', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ releaseDate: new Date('2000-01-02') })
                    .ok()
                expectEqualUnsorted(body.items, [movies[1], movies[2]])
            })

            // 줄거리 일부로 영화를 필터링한다
            it('filters movies by a partial plot', async () => {
                const { body } = await fix.httpClient.get('/movies').query({ plot: 'plot-b' }).ok()
                expectEqualUnsorted(body.items, [movies[2], movies[3]])
            })

            // 감독 일부로 영화를 필터링한다
            it('filters movies by a partial director name', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ director: 'James' })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[2]])
            })

            // 등급으로 영화를 필터링한다
            it('filters movies by rating', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ rating: MovieRating.NC17 })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[1]])
            })
        })

        // 쿼리 파라미터가 유효하지 않은 경우
        describe('when query parameters are invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('getMoviesByIds()', () => {
        let movies: MovieDto[]

        beforeEach(async () => {
            movies = await Promise.all([createMovie(fix), createMovie(fix), createMovie(fix)])
        })

        // 영화 ID가 존재하는 경우
        describe('when the movie IDs exist', () => {
            // 해당 영화들을 반환한다
            it('returns the movies', async () => {
                const expectedMovies = movies.slice(0, 2)
                const movieIds = pickIds(expectedMovies)
                const gotMovies = await fix.moviesClient.getMoviesByIds(movieIds)
                expectEqualUnsorted(gotMovies, expectedMovies)
            })
        })

        // 영화 ID가 존재하지 않는 경우
        describe('when the movie IDs do not exist', () => {
            // NotFoundException을 던진다
            it('throws NotFoundException', async () => {
                const promise = fix.moviesClient.getMoviesByIds([nullObjectId])
                await expect(promise).rejects.toThrow('One or more documents not found')
            })
        })
    })
})
