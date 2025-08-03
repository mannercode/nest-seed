import { CreateMovieDto, MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { FileUtil, Path } from 'common'
import { nullObjectId, objectToFields } from 'testlib'
import { buildCreateMovieDto, createMovie2, Errors } from '../__helpers__'
import { MoviesFixture } from './movies.fixture'

describe('MoviesService', () => {
    let fix: MoviesFixture

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
            let createdMovie: MovieDto
            let tempDir: string

            beforeEach(async () => {
                tempDir = await Path.createTempDirectory()

                createDto = buildCreateMovieDto()

                const { body } = await fix.httpClient
                    .post('/movies')
                    .attachments([{ name: 'files', file: fix.image.path }])
                    .fields(objectToFields(createDto))
                    .created()

                createdMovie = body
            })

            afterEach(async () => {
                await Path.delete(tempDir)
            })

            // 영화를 생성하고 반환한다
            it('creates and returns the movie', async () => {
                expect(createdMovie).toEqual({
                    id: expect.any(String),
                    imageUrls: expect.any(Array),
                    ...createDto
                })
            })

            // 첨부된 파일을 다운로드한다
            it('downloads the attached file', async () => {
                const downloadPath = Path.join(tempDir, 'download.tmp')

                await fix.httpClient.get(createdMovie.imageUrls[0]).download(downloadPath).ok()

                expect(await FileUtil.areEqual(downloadPath, fix.image.path)).toBeTruthy()
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

    describe('GET /movies/:id', () => {
        // 영화가 존재하는 경우
        describe('when the movie exists', () => {
            // 영화 정보를 반환한다
            it('returns the movie', async () => {
                await fix.httpClient.get(`/movies/${fix.createdMovie.id}`).ok(fix.createdMovie)
            })
        })

        // 영화가 존재하지 않는 경우
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/movies/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })

    describe('PATCH /movies/:id', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 영화 정보를 수정하고 반환한다
            it('updates and returns the movie', async () => {
                const updateDto = {
                    title: 'update title',
                    genres: ['romance', 'thriller'],
                    releaseDate: new Date('2000-01-01'),
                    plot: 'new plot',
                    durationInSeconds: 10 * 60,
                    director: 'Steven Spielberg',
                    rating: 'R'
                }
                const expected = { ...fix.createdMovie, ...updateDto }

                await fix.httpClient
                    .patch(`/movies/${fix.createdMovie.id}`)
                    .body(updateDto)
                    .ok(expected)

                await fix.httpClient.get(`/movies/${fix.createdMovie.id}`).ok(expected)
            })
        })

        // payload가 비어있는 경우
        describe('when the payload is empty', () => {
            // 원래 영화 정보를 반환한다
            it('returns the original movie', async () => {
                await fix.httpClient
                    .patch(`/movies/${fix.createdMovie.id}`)
                    .body({})
                    .ok(fix.createdMovie)
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
            beforeEach(async () => {
                await fix.httpClient
                    .delete(`/movies/${fix.createdMovie.id}`)
                    .ok({ deletedMovies: [fix.createdMovie] })
            })

            // 영화를 삭제한다
            it('deletes the movie', async () => {
                await fix.httpClient
                    .get(`/movies/${fix.createdMovie.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [fix.createdMovie.id]
                    })
            })

            // 영화와 관련된 파일을 삭제한다
            it('deletes the movie’s files', async () => {
                const fileUrl = fix.createdMovie.imageUrls[0]

                await fix.httpClient
                    .get(fileUrl)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [expect.any(String)]
                    })
            })
        })

        // 영화가 존재하지 않는 경우
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .delete(`/movies/${nullObjectId}`)
                    .notFound({
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
                createMovie2(fix, {
                    title: 'title-a1',
                    plot: 'plot-a1',
                    director: 'James Cameron',
                    releaseDate: new Date('2000-01-01'),
                    rating: MovieRating.NC17,
                    genres: [MovieGenre.Action, MovieGenre.Comedy]
                }),
                createMovie2(fix, {
                    title: 'title-a2',
                    plot: 'plot-a2',
                    director: 'Steven Spielberg',
                    releaseDate: new Date('2000-01-02'),
                    rating: MovieRating.NC17,
                    genres: [MovieGenre.Romance, MovieGenre.Drama]
                }),
                createMovie2(fix, {
                    title: 'title-b1',
                    plot: 'plot-b1',
                    director: 'James Cameron',
                    releaseDate: new Date('2000-01-02'),
                    rating: MovieRating.PG,
                    genres: [MovieGenre.Drama, MovieGenre.Comedy]
                }),
                createMovie2(fix, {
                    title: 'title-b2',
                    plot: 'plot-b2',
                    director: 'Steven Spielberg',
                    releaseDate: new Date('2000-01-03'),
                    rating: MovieRating.R,
                    genres: [MovieGenre.Thriller, MovieGenre.Western]
                })
            ])

            movies = [...createdMovies, fix.createdMovie]
        })

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 기본 페이지네이션으로 영화 목록을 반환한다
            it('returns the movie list with default pagination', async () => {
                await fix.httpClient
                    .get('/movies')
                    .ok({
                        skip: 0,
                        take: expect.any(Number),
                        total: movies.length,
                        items: expect.arrayContaining(movies)
                    })
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
            // 제목이 해당 부분 문자열을 포함하는 영화 목록을 반환한다
            it('returns the movie list whose title contains the given substring', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ title: 'title-a' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([movies[0], movies[1]])
                        })
                    )
            })
        })

        // `genre`가 제공된 경우
        describe('when `genre` is provided', () => {
            // 지정한 장르와 일치하는 영화 목록을 반환한다
            it('returns the movie list matching the given genre', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ genre: MovieGenre.Drama })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([movies[1], movies[2]])
                        })
                    )
            })
        })

        // `releaseDate`가 제공된 경우
        describe('when `releaseDate` is provided', () => {
            // 지정된 날짜에 개봉한 영화 목록을 반환한다
            it('returns the movie list released on the given date', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ releaseDate: new Date('2000-01-02') })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([movies[1], movies[2]])
                        })
                    )
            })
        })

        // `plot` 부분 문자열이 제공된 경우
        describe('when a partial `plot` is provided', () => {
            // 줄거리에 해당 부분 문자열을 포함하는 영화 목록을 반환한다
            it('returns the movie list whose plot contains the given substring', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ plot: 'plot-b' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([movies[2], movies[3]])
                        })
                    )
            })
        })

        // `director` 부분 문자열이 제공된 경우
        describe('when a partial `director` is provided', () => {
            // 감독 이름에 해당 부분 문자열이 포함된 영화 목록을 반환한다
            it('returns the movie list whose director`s name contains the given substring', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ director: 'James' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([movies[0], movies[2]])
                        })
                    )
            })
        })

        // `rating`이 제공된 경우
        describe('when `rating` is provided', () => {
            // 지정한 등급과 일치하는 영화 목록을 반환한다
            it('returns the movie list matching the given rating', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ rating: MovieRating.NC17 })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([movies[0], movies[1]])
                        })
                    )
            })
        })
    })
})
