import { CreateMovieDto, MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { FileUtil, Path } from 'common'
import { readFile, writeFile } from 'fs/promises'
import { nullObjectId } from 'testlib'
import { buildCreateMovieDto, createMovie, Errors } from '../__helpers__'
import type { Fixture } from './movies.fixture'

describe('MoviesService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./movies.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /movies', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            let createDto: CreateMovieDto
            let createdMovie: MovieDto
            let imageFileId: string

            const uploadMovieImage = async () => {
                const payload = {
                    originalName: fixture.image.originalName,
                    mimeType: fixture.image.mimeType,
                    size: fixture.image.size,
                    checksum: fixture.image.checksum.value
                }

                const { body } = await fixture.httpClient
                    .post('/attachments')
                    .body(payload)
                    .created()

                const uploadRes = await fetch(body.uploadUrl, {
                    method: body.method,
                    headers: body.headers,
                    body: await readFile(fixture.image.path)
                })

                expect(uploadRes.ok).toBe(true)

                return body.attachmentId
            }

            beforeEach(async () => {
                createDto = buildCreateMovieDto()
                imageFileId = await uploadMovieImage()

                const { body } = await fixture.httpClient
                    .post('/movies')
                    .body({ ...createDto, imageFileIds: [imageFileId] })
                    .created()

                createdMovie = body
            })

            // TODO fix
            // 영화를 생성하고 반환한다
            it('creates and returns a movie', async () => {
                expect(createdMovie).toEqual({
                    id: expect.any(String),
                    ...createDto,
                    imageFileIds: [imageFileId],
                    imageUrl: expect.any(String),
                    imageUrls: [expect.any(String)]
                })
            })

            // 첨부된 파일을 다운로드한다
            it('downloads the attached file', async () => {
                const downloadPath = Path.join(fixture.tempDir, 'download.tmp')

                const { body: movie } = await fixture.httpClient
                    .get(`/movies/${createdMovie.id}`)
                    .ok(
                        expect.objectContaining({
                            id: createdMovie.id,
                            imageFileIds: [imageFileId],
                            imageUrl: expect.any(String)
                        })
                    )

                const res = await fetch(movie.imageUrl)
                expect(res.ok).toBe(true)

                const downloadedBuffer = Buffer.from(await res.arrayBuffer())
                await writeFile(downloadPath, downloadedBuffer)

                expect(await FileUtil.areEqual(downloadPath, fixture.image.path)).toBe(true)
            })
        })

        // 필수 필드가 누락된 경우
        describe('when the required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/movies')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /movies/:id', () => {
        // 영화가 존재하는 경우
        describe('when the movie exists', () => {
            // 영화를 반환한다
            it('returns the movie', async () => {
                await fixture.httpClient
                    .get(`/movies/${fixture.createdMovie.id}`)
                    .ok(fixture.createdMovie)
            })
        })

        // 영화가 존재하지 않는 경우
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
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
            // 영화를 수정하고 반환한다
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
                const expected = expect.objectContaining({
                    id: fixture.createdMovie.id,
                    imageFileIds: fixture.createdMovie.imageFileIds,
                    imageUrl: expect.any(String),
                    imageUrls: expect.any(Array),
                    ...updateDto
                })

                await fixture.httpClient
                    .patch(`/movies/${fixture.createdMovie.id}`)
                    .body(updateDto)
                    .ok(expected)

                await fixture.httpClient.get(`/movies/${fixture.createdMovie.id}`).ok(expected)
            })
        })

        // 영화가 존재하지 않는 경우
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .patch(`/movies/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /movies/:id', () => {
        // 존재하는 영화를 삭제 요청하면
        describe('when deleting an existing movie', () => {
            let deletedFileId: string

            beforeEach(async () => {
                deletedFileId = fixture.createdMovie.imageFileIds[0]

                await fixture.httpClient
                    .delete(`/movies/${fixture.createdMovie.id}`)
                    .ok({
                        deletedMovies: expect.arrayContaining([
                            expect.objectContaining({
                                id: fixture.createdMovie.id,
                                title: fixture.createdMovie.title,
                                imageFileIds: fixture.createdMovie.imageFileIds
                            })
                        ])
                    })
            })

            // 영화 문서를 더 이상 조회할 수 없다
            it('cannot fetch the movie anymore', async () => {
                await fixture.httpClient
                    .get(`/movies/${fixture.createdMovie.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [fixture.createdMovie.id]
                    })
            })

            // 영화와 관련된 파일도 삭제된다
            it("deletes the movie's files", async () => {
                await fixture.httpClient.get(`/attachments/${deletedFileId}`).notFound()
            })
        })

        // 존재하지 않는 영화를 삭제 요청하면
        describe('when deleting a non-existent movie', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
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
        const expectMovie = (movie: MovieDto) =>
            expect.objectContaining({
                id: movie.id,
                title: movie.title,
                genres: movie.genres,
                releaseDate: movie.releaseDate,
                plot: movie.plot,
                durationInSeconds: movie.durationInSeconds,
                director: movie.director,
                rating: movie.rating,
                imageFileIds: movie.imageFileIds,
                imageUrl: expect.any(String),
                imageUrls: expect.any(Array)
            })

        beforeEach(async () => {
            const createdMovies = await Promise.all([
                createMovie(fixture, {
                    title: 'title-a1',
                    plot: 'plot-a1',
                    director: 'James Cameron',
                    releaseDate: new Date('2000-01-01'),
                    rating: MovieRating.NC17,
                    genres: [MovieGenre.Action, MovieGenre.Comedy]
                }),
                createMovie(fixture, {
                    title: 'title-a2',
                    plot: 'plot-a2',
                    director: 'Steven Spielberg',
                    releaseDate: new Date('2000-01-02'),
                    rating: MovieRating.NC17,
                    genres: [MovieGenre.Romance, MovieGenre.Drama]
                }),
                createMovie(fixture, {
                    title: 'title-b1',
                    plot: 'plot-b1',
                    director: 'James Cameron',
                    releaseDate: new Date('2000-01-02'),
                    rating: MovieRating.PG,
                    genres: [MovieGenre.Drama, MovieGenre.Comedy]
                }),
                createMovie(fixture, {
                    title: 'title-b2',
                    plot: 'plot-b2',
                    director: 'Steven Spielberg',
                    releaseDate: new Date('2000-01-03'),
                    rating: MovieRating.R,
                    genres: [MovieGenre.Thriller, MovieGenre.Western]
                })
            ])

            movies = [...createdMovies, fixture.createdMovie]
        })

        // 쿼리 파라미터가 없는 경우
        describe('when the query parameters are missing', () => {
            // 기본 페이지네이션으로 영화를 반환한다
            it('returns movies with default pagination', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .ok({
                        skip: 0,
                        take: expect.any(Number),
                        total: movies.length,
                        items: expect.arrayContaining(movies.map(expectMovie))
                    })
            })
        })

        // 쿼리 파라미터가 유효하지 않은 경우
        describe('when the query parameters are invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })

        // `title` 부분 문자열이 제공된 경우
        describe('when a partial `title` is provided', () => {
            // 제목이 해당 부분 문자열을 포함하는 영화를 반환한다
            it('returns movies whose title contains the given substring', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ title: 'title-a' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([
                                expectMovie(movies[0]),
                                expectMovie(movies[1])
                            ])
                        })
                    )
            })
        })

        // `genre`가 제공된 경우
        describe('when the `genre` is provided', () => {
            // 지정한 장르와 일치하는 영화를 반환한다
            it('returns movies matching the given genre', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ genre: MovieGenre.Drama })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([
                                expectMovie(movies[1]),
                                expectMovie(movies[2])
                            ])
                        })
                    )
            })
        })

        // `releaseDate`가 제공된 경우
        describe('when the `releaseDate` is provided', () => {
            // 지정된 날짜에 개봉한 영화를 반환한다
            it('returns movies released on the given date', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ releaseDate: new Date('2000-01-02') })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([
                                expectMovie(movies[1]),
                                expectMovie(movies[2])
                            ])
                        })
                    )
            })
        })

        // `plot` 부분 문자열이 제공된 경우
        describe('when a partial `plot` is provided', () => {
            // 줄거리에 해당 부분 문자열을 포함하는 영화를 반환한다
            it('returns movies whose plot contains the given substring', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ plot: 'plot-b' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([
                                expectMovie(movies[2]),
                                expectMovie(movies[3])
                            ])
                        })
                    )
            })
        })

        // `director` 부분 문자열이 제공된 경우
        describe('when a partial `director` is provided', () => {
            // 감독 이름에 해당 부분 문자열이 포함된 영화를 반환한다
            it("returns movies whose director's name includes the substring", async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ director: 'James' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([
                                expectMovie(movies[0]),
                                expectMovie(movies[2])
                            ])
                        })
                    )
            })
        })

        // `rating`이 제공된 경우
        describe('when the `rating` is provided', () => {
            // 지정한 등급과 일치하는 영화를 반환한다
            it('returns movies matching the given rating', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ rating: MovieRating.NC17 })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([
                                expectMovie(movies[0]),
                                expectMovie(movies[1])
                            ])
                        })
                    )
            })
        })
    })
})
