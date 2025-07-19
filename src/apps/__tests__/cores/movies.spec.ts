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
        // 상황: 유효한 데이터와 파일로 요청할 때
        describe('with valid data and attachments', () => {
            // 기대 결과: 새로운 영화를 생성한다.
            it('creates a new movie', async () => {
                const { createDto, expectedDto } = buildCreateMovieDto()

                const { body } = await fix.httpClient
                    .post('/movies')
                    .attachments([{ name: 'files', file: fix.image.path }])
                    .fields(objectToFields(createDto))
                    .created()

                expect(body).toEqual(expectedDto)
            })
        })

        // 상황: 필수 필드가 누락되었을 때
        describe('with missing required fields', () => {
            // 기대 결과: 400 Bad Request 에러를 반환한다.
            it('returns a 400 Bad Request error', async () => {
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

        // 상황: 유효한 데이터로 요청할 때
        describe('with valid update data', () => {
            // 기대 결과: 영화 정보를 수정한다.
            it('updates the movie details', async () => {
                const updateDto = {
                    title: 'update title',
                    genres: ['romance', 'thriller'],
                    releaseDate: new Date('2000-01-01'),
                    plot: `new plot`,
                    durationInSeconds: 10 * 60,
                    director: 'Steven Spielberg',
                    rating: 'R'
                }
                const expected = { ...movie, ...updateDto }

                await fix.httpClient.patch(`/movies/${movie.id}`).body(updateDto).ok(expected)
                await fix.httpClient.get(`/movies/${movie.id}`).ok(expected)
            })
        })

        // 상황: 빈 데이터로 업데이트 요청할 때
        describe('with an empty update payload', () => {
            // 기대 결과: 변경 없이 기존 영화 정보를 반환한다.
            it('returns the unchanged movie details', async () => {
                await fix.httpClient.patch(`/movies/${movie.id}`).body({}).ok(movie)
            })
        })

        // 상황: 존재하지 않는 영화일 때
        describe('when the movie does not exist', () => {
            // 기대 결과: 404 Not Found 에러를 반환한다.
            it('returns a 404 Not Found error', async () => {
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

        // 상황: 존재하는 영화일 때
        describe('when the movie exists', () => {
            // 기대 결과: 영화와 연관된 파일을 함께 삭제한다.
            it('deletes the movie and its associated files', async () => {
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

        // 상황: 존재하지 않는 영화일 때
        describe('when the movie does not exist', () => {
            // 기대 결과: 404 Not Found 에러를 반환한다.
            it('returns a 404 Not Found error', async () => {
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

        // 상황: 존재하는 영화일 때
        describe('when the movie exists', () => {
            // 기대 결과: 영화 상세 정보를 반환한다.
            it('returns the movie details', async () => {
                await fix.httpClient.get(`/movies/${movie.id}`).ok(movie)
            })
        })

        // 상황: 존재하지 않는 영화일 때
        describe('when the movie does not exist', () => {
            // 기대 결과: 404 Not Found 에러를 반환한다.
            it('returns a 404 Not Found error', async () => {
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

        // 상황: 쿼리 파라미터 없이 요청할 때
        describe('without any query parameters', () => {
            // 기대 결과: 기본 페이지네이션으로 영화 목록을 반환한다.
            it('returns a paginated list of movies', async () => {
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

        // 상황: 다양한 조건으로 필터링할 때
        describe('when filtering with various criteria', () => {
            // 기대 결과: 부분 제목과 일치하는 영화 목록을 반환한다.
            it('returns movies filtered by partial title', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ title: 'title-a' })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[1]])
            })

            // 기대 결과: 특정 장르를 포함하는 영화 목록을 반환한다.
            it('returns movies filtered by genre', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ genre: MovieGenre.Drama })
                    .ok()
                expectEqualUnsorted(body.items, [movies[1], movies[2]])
            })

            // 기대 결과: 특정 개봉일과 일치하는 영화 목록을 반환한다.
            it('returns movies filtered by release date', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ releaseDate: new Date('2000-01-02') })
                    .ok()
                expectEqualUnsorted(body.items, [movies[1], movies[2]])
            })

            // 기대 결과: 부분 줄거리와 일치하는 영화 목록을 반환한다.
            it('returns movies filtered by partial plot', async () => {
                const { body } = await fix.httpClient.get('/movies').query({ plot: 'plot-b' }).ok()
                expectEqualUnsorted(body.items, [movies[2], movies[3]])
            })

            // 기대 결과: 부분 감독 이름과 일치하는 영화 목록을 반환한다.
            it('returns movies filtered by partial director name', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ director: 'James' })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[2]])
            })

            // 기대 결과: 특정 등급과 일치하는 영화 목록을 반환한다.
            it('returns movies filtered by rating', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ rating: MovieRating.NC17 })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[1]])
            })
        })

        // 상황: 유효하지 않은 쿼리 필드로 요청할 때
        describe('with an invalid query parameter', () => {
            // 기대 결과: 400 Bad Request 에러를 반환한다.
            it('returns a 400 Bad Request error', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('getMoviesByIds', () => {
        let movies: MovieDto[]

        beforeEach(async () => {
            movies = await Promise.all([createMovie(fix), createMovie(fix), createMovie(fix)])
        })

        // 상황: 유효한 ID 목록으로 요청할 때
        describe('with a list of valid movie IDs', () => {
            // 기대 결과: 해당 영화 목록을 반환한다.
            it('returns the corresponding movies', async () => {
                const expectedMovies = movies.slice(0, 2)
                const movieIds = pickIds(expectedMovies)
                const gotMovies = await fix.moviesClient.getMoviesByIds(movieIds)
                expectEqualUnsorted(gotMovies, expectedMovies)
            })
        })

        // 상황: 존재하지 않는 ID가 포함된 목록으로 요청할 때
        describe('with a list containing a non-existent movie ID', () => {
            // 기대 결과: NotFoundException 예외를 던진다.
            it('throws a NotFoundException', async () => {
                const promise = fix.moviesClient.getMoviesByIds([nullObjectId])
                await expect(promise).rejects.toThrow('One or more documents not found')
            })
        })
    })
})
