import { CreateMovieDto, MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { FileUtil, Path } from 'common'
import { writeFile } from 'fs/promises'
import { nullObjectId, objectToFields } from 'testlib'
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

            beforeEach(async () => {
                createDto = buildCreateMovieDto()
                const { body } = await fixture.httpClient
                    .post('/movies')
                    .attachments([{ name: 'files', file: fixture.image.path }])
                    .fields(objectToFields(createDto))
                    .created()

                createdMovie = body
            })

            // TODO fix
            // 영화를 생성하고 반환한다
            it('creates and returns a movie', async () => {
                expect(createdMovie).toEqual({
                    id: expect.any(String),
                    imageUrls: expect.any(Array),
                    ...createDto
                })
            })

            // 첨부된 파일을 다운로드한다
            it('downloads the attached file', async () => {
                const downloadPath = Path.join(fixture.tempDir, 'download.tmp')

                const { body: downloadInfo } = await fixture.httpClient
                    .get(createdMovie.imageUrls[0])
                    .ok()

                const res = await fetch(downloadInfo.downloadUrl)
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
                const expected = { ...fixture.createdMovie, ...updateDto }

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
            beforeEach(async () => {
                await fixture.httpClient
                    .delete(`/movies/${fixture.createdMovie.id}`)
                    .ok({ deletedMovies: [fixture.createdMovie] })
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
                const fileUrl = fixture.createdMovie.imageUrls[0]

                await fixture.httpClient
                    .get(fileUrl)
                    .notFound({
                        ...Errors.Mongoose.DocumentNotFound,
                        notFoundId: expect.any(String)
                    })
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
                        items: expect.arrayContaining(movies)
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
                            items: expect.arrayContaining([movies[0], movies[1]])
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
                            items: expect.arrayContaining([movies[1], movies[2]])
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
                            items: expect.arrayContaining([movies[1], movies[2]])
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
                            items: expect.arrayContaining([movies[2], movies[3]])
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
                            items: expect.arrayContaining([movies[0], movies[2]])
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
                            items: expect.arrayContaining([movies[0], movies[1]])
                        })
                    )
            })
        })
    })
})

// describe('/movies/drafts', () => {
//     let draftId: string

//     // 영화를 생성한다
//     it('creates a movie', async () => {
//         await step('POST /movies/drafts', async () => {
//             const { body } = await fixture.httpClient.post('/movies/drafts').body({}).created()

//             expect(body).toEqual({ id: expect.any(String), expiresAt: expect.any(Date) })
//             draftId = body.id

//             console.log(body)
//         })

//         await step('POST /movies/drafts/{draftId}/assets:presign', async () => {
//             const { body } = await fixture.httpClient
//                 .post(`/movies/drafts/${draftId}/assets:presign`)
//                 .body({
//                     contentType: fixture.image.mimeType,
//                     size: fixture.image.size,
//                     checksum: fixture.image.checksum.value
//                 })
//                 .created()

//             expect(body).toEqual({
//                 // sessionId,
//                 // uploadUrl,
//                 // method,
//                 // headers,
//                 // key,
//                 // expiresAt,
//                 // maxSize
//             })

//             expect(body).toEqual({ draftId: expect.any(String), expiresAt: expect.any(Date) })
//             draftId = body.draftId
//         })
//         await step('POST /movies/drafts/{draftId}/assets:finalize', async () => {})
//         await step('POST /movies/drafts/{draftId}:finalize', async () => {})
//     })
// })

// describe.skip('POST /movie-creation/image-upload-url', () => {
//     beforeEach(async () => {})

//     // `theaterIds`가 제공된 경우
//     describe('when the `theaterIds` value is provided', () => {
//         // 지정한 theaterIds와 일치하는 상영시간 목록을 반환한다
//         it('returns showtimes matching the given theaterIds', async () => {
//             await fixture.httpClient
//                 .post('/movie-creation/presigned-url')
//                 .body({
//                     contentType: fixture.image.mimeType,
//                     contentLength: fixture.image.size,
//                     checksum: fixture.image.checksum,
//                     filename: fixture.image.originalName
//                 })
//                 .ok({
//                     fileId: 'movies/mv_9a2f/posters/usn_01J8K2....jpg',
//                     upload: {
//                         method: 'PUT',
//                         url: 'https://bucket.s3...X-Amz-Signature=...',
//                         headers: { 'Content-Type': 'image/jpeg', 'Content-MD5': '...' },
//                         expiresAt: '2025-08-21T00:15:00Z'
//                     }
//                 })
//         })
//     })
// })
