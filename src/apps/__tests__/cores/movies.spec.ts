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
        // 유효한 데이터와 첨부 파일을 제공한 경우
        describe('when provided valid data and attachments', () => {
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
        describe('when required fields are missing', () => {
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
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix)
        })

        // 유효한 데이터가 제공된 경우
        describe('when provided valid data', () => {
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
                const expected = { ...movie, ...updateDto }

                await fix.httpClient.patch(`/movies/${movie.id}`).body(updateDto).ok(expected)
                await fix.httpClient.get(`/movies/${movie.id}`).ok(expected)
            })
        })

        // 페이로드가 비어있을 때
        describe('when the payload is empty', () => {
            // 원래 영화 정보를 반환한다
            it('returns the original movie', async () => {
                await fix.httpClient.patch(`/movies/${movie.id}`).body({}).ok(movie)
            })
        })

        // 영화가 존재하지 않을 때
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
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix)
        })

        // 영화가 존재할 때
        describe('when the movie exists', () => {
            // 영화를 삭제하고 파일도 삭제한다
            it('deletes the movie and its files', async () => {
                const fileUrl = movie.images[0]
                const fileId = Path.basename(fileUrl)

                await fix.httpClient.delete(`/movies/${movie.id}`).ok()

                await fix.httpClient.get(`/movies/${movie.id}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [movie.id]
                })

                await fix.httpClient.get(fileUrl).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [fileId]
                })
            })
        })

        // 영화가 존재하지 않을 때
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
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix)
        })

        // 영화가 존재할 때
        describe('when the movie exists', () => {
            // 해당 영화를 반환한다
            it('returns the movie', async () => {
                await fix.httpClient.get(`/movies/${movie.id}`).ok(movie)
            })
        })

        // 영화가 존재하지 않을 때
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
            movies = await Promise.all([
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
        })

        // 쿼리 파라미터 없이 요청한 경우
        describe('without any query parameters', () => {
            // 기본 페이지네이션으로 영화를 반환한다
            it('returns movies using default pagination', async () => {
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

        // 다양한 조건으로 필터링할 때
        describe('when filtering with various criteria', () => {
            // 제목 일부로 영화를 필터링한다
            it('filters movies by partial title', async () => {
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
            it('filters movies by partial plot', async () => {
                const { body } = await fix.httpClient.get('/movies').query({ plot: 'plot-b' }).ok()
                expectEqualUnsorted(body.items, [movies[2], movies[3]])
            })

            // 감독 일부로 영화를 필터링한다
            it('filters movies by partial director', async () => {
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

        // 잘못된 쿼리 파라미터를 제공한 경우
        describe('with an invalid query parameter', () => {
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

        // 유효한 영화 ID를 제공한 경우
        describe('when given valid movie IDs', () => {
            // 해당 영화들을 반환한다
            it('returns the movies', async () => {
                const expectedMovies = movies.slice(0, 2)
                const movieIds = pickIds(expectedMovies)
                const gotMovies = await fix.moviesClient.getMoviesByIds(movieIds)
                expectEqualUnsorted(gotMovies, expectedMovies)
            })
        })

        // 존재하지 않는 영화 ID를 제공한 경우
        describe('when given a non‑existent movie ID', () => {
            // NotFoundException을 던진다
            it('throws NotFoundException', async () => {
                const promise = fix.moviesClient.getMoviesByIds([nullObjectId])
                await expect(promise).rejects.toThrow('One or more documents not found')
            })
        })
    })
})
