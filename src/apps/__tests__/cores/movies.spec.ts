import { CreateMovieDto, MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { generateShortId, getChecksum, Path, pickIds } from 'common'
import { expectEqualUnsorted, nullObjectId, objectToFields } from 'testlib'
import { Errors } from '../__helpers__'
import { buildCreateMovieDto, createMovie, getStorageFiles } from '../common.fixture'
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
            let createDto: CreateMovieDto
            let movie: MovieDto
            let tempDir: string

            beforeEach(async () => {
                tempDir = await Path.createTempDirectory()

                // Arrange
                createDto = buildCreateMovieDto()

                // Act
                const { body } = await fix.httpClient
                    .post('/movies')
                    .attachments([{ name: 'files', file: fix.image.path }])
                    .fields(objectToFields(createDto))
                    .created()

                movie = body
            })

            afterEach(async () => {
                await Path.delete(tempDir)
            })

            // 영화를 생성하고 반환한다
            it('creates and returns the movie', async () => {
                expect(movie).toEqual({
                    id: expect.any(String),
                    images: expect.any(Array),
                    ...createDto
                })
            })

            // 첨부한 파일을 다운로드한다
            it('downloads the attached file', async () => {
                const downloadPath = Path.join(tempDir, generateShortId() + '.tmp')

                await fix.httpClient.get(movie.imageUrls[0]).download(downloadPath).ok()

                expect(await Path.getSize(downloadPath)).toEqual(fix.image.size)
                expect(await getChecksum(downloadPath)).toEqual(await getChecksum(fix.image.path))
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
            // 영화 정보를 수정하고 반환한다
            it('returns and updates the movie', async () => {
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
                const fileUrl = fix.movie.imageUrls[0]
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
            // 기본 페이지네이션으로 영화를 반환한다
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

        // `title` 부분 문자열이 제공된 경우
        describe('when a partial `title` is provided', () => {
            // 제목이 해당 부분 문자열을 포함하는 영화를 반환한다
            it('returns movies whose title contains the given substring', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ title: 'title-a' })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[1]])
            })
        })

        // `genre`가 제공된 경우
        describe('when `genre` is provided', () => {
            // 장르가 일치하는 영화를 반환한다
            it('returns movies that match the given genre', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ genre: MovieGenre.Drama })
                    .ok()
                expectEqualUnsorted(body.items, [movies[1], movies[2]])
            })
        })

        // `releaseDate`가 제공된 경우
        describe('when `releaseDate` is provided', () => {
            // 지정된 날짜에 개봉한 영화를 반환한다
            it('returns movies released on the given date', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ releaseDate: new Date('2000-01-02') })
                    .ok()
                expectEqualUnsorted(body.items, [movies[1], movies[2]])
            })
        })

        // `plot` 부분 문자열이 제공된 경우
        describe('when a partial `plot` is provided', () => {
            // 줄거리에 해당 부분 문자열을 포함하는 영화를 반환한다
            it('returns movies whose plot contains the given substring', async () => {
                const { body } = await fix.httpClient.get('/movies').query({ plot: 'plot-b' }).ok()
                expectEqualUnsorted(body.items, [movies[2], movies[3]])
            })
        })

        // `director` 부분 문자열이 제공된 경우
        describe('when a partial `director` name is provided', () => {
            // 감독 이름에 해당 부분 문자열을 포함하는 영화를 반환한다
            it('returns movies whose director name contains the given substring', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ director: 'James' })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[2]])
            })
        })

        // `rating`이 제공된 경우
        describe('when `rating` is provided', () => {
            // 등급이 일치하는 영화를 반환한다
            it('returns movies that match the given rating', async () => {
                const { body } = await fix.httpClient
                    .get('/movies')
                    .query({ rating: MovieRating.NC17 })
                    .ok()
                expectEqualUnsorted(body.items, [movies[0], movies[1]])
            })
        })
    })
})
