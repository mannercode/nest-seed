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
        describe('when the payload is valid', () => {
            let createDto: CreateMovieDto
            let createdMovie: MovieDto
            let imageAssetId: string

            const uploadMovieImage = async () => {
                const payload = {
                    originalName: fixture.image.originalName,
                    mimeType: fixture.image.mimeType,
                    size: fixture.image.size,
                    checksum: fixture.image.checksum.value
                }

                const body = await fixture.assetsClient.create(payload)

                const uploadRes = await fetch(body.uploadUrl, {
                    method: body.method,
                    headers: body.headers,
                    body: await readFile(fixture.image.path)
                })

                expect(uploadRes.ok).toBe(true)

                return body.assetId
            }

            beforeEach(async () => {
                createDto = buildCreateMovieDto()
                imageAssetId = await uploadMovieImage()

                const { body } = await fixture.httpClient
                    .post('/movies')
                    .body({ ...createDto, imageAssetIds: [imageAssetId] })
                    .created()

                createdMovie = body
            })

            // TODO fix
            // 영화를 생성하고 반환한다
            it('creates and returns a movie', async () => {
                expect(createdMovie).toEqual({
                    id: expect.any(String),
                    ...createDto,
                    imageAssetIds: [imageAssetId],
                    imageUrl: expect.any(String),
                    imageUrls: [expect.any(String)]
                })
            })

            it('downloads the uploaded asset', async () => {
                const downloadPath = Path.join(fixture.tempDir, 'download.tmp')

                const { body: movie } = await fixture.httpClient
                    .get(`/movies/${createdMovie.id}`)
                    .ok(
                        expect.objectContaining({
                            id: createdMovie.id,
                            imageAssetIds: [imageAssetId],
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

        describe('when the required fields are missing', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/movies')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /movies/:id', () => {
        describe('when the movie exists', () => {
            it('returns the movie', async () => {
                await fixture.httpClient
                    .get(`/movies/${fixture.createdMovie.id}`)
                    .ok(fixture.createdMovie)
            })
        })

        describe('when the movie does not exist', () => {
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
        describe('when the payload is valid', () => {
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
                    imageAssetIds: fixture.createdMovie.imageAssetIds,
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

        describe('when the movie does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .patch(`/movies/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /movies/:id', () => {
        describe('when deleting an existing movie', () => {
            let deletedAssetId: string

            beforeEach(async () => {
                deletedAssetId = fixture.createdMovie.imageAssetIds[0]

                await fixture.httpClient
                    .delete(`/movies/${fixture.createdMovie.id}`)
                    .ok({
                        deletedMovies: expect.arrayContaining([
                            expect.objectContaining({
                                id: fixture.createdMovie.id,
                                title: fixture.createdMovie.title,
                                imageAssetIds: fixture.createdMovie.imageAssetIds
                            })
                        ])
                    })
            })

            it('cannot fetch the movie anymore', async () => {
                await fixture.httpClient
                    .get(`/movies/${fixture.createdMovie.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [fixture.createdMovie.id]
                    })
            })

            it("deletes the movie's assets", async () => {
                await fixture.httpClient.get(`/assets/${deletedAssetId}`).notFound()
            })
        })

        describe('when deleting a non-existent movie', () => {
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
                imageAssetIds: movie.imageAssetIds,
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

        describe('when the query parameters are missing', () => {
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

        describe('when the query parameters are invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })

        describe('when a partial `title` is provided', () => {
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

        describe('when the `genre` is provided', () => {
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

        describe('when the `releaseDate` is provided', () => {
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

        describe('when a partial `plot` is provided', () => {
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

        describe('when a partial `director` is provided', () => {
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

        describe('when the `rating` is provided', () => {
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
