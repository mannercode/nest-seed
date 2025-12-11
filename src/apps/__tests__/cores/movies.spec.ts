import { CreateMovieDto, MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { Checksum } from 'common'
import { nullObjectId } from 'testlib'
import { buildCreateMovieDto, createMovie, Errors } from '../__helpers__'
import type { MoviesFixture } from './movies.fixture'

describe('MoviesService', () => {
    let fixture: MoviesFixture

    beforeEach(async () => {
        const { createMoviesFixture } = await import('./movies.fixture')
        fixture = await createMoviesFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /movies', () => {
        describe('when the payload is valid', () => {
            let createDto: CreateMovieDto
            let createdMovie: MovieDto

            beforeEach(async () => {
                createDto = buildCreateMovieDto()
                const { body } = await fixture.httpClient.post('/movies').body(createDto).created()

                createdMovie = body
            })

            // TODO fix
            // 영화를 생성하고 반환한다
            it('creates and returns a movie', async () => {
                const { assetIds: _, ...movieDto } = createDto

                expect(createdMovie).toEqual({ ...movieDto, id: expect.any(String), imageUrls: [] })
            })
        })

        it('creates and returns a movie', async () => {
            const createDto = buildCreateMovieDto({ genres: [] })

            await fixture.httpClient.post('/movies').body(createDto).created()
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

            it('downloads the uploaded asset', async () => {
                const { body: movieDto } = await fixture.httpClient
                    .get(`/movies/${fixture.createdMovie.id}`)
                    .ok()

                const downloadResponse = await fetch(movieDto.imageUrls[0])
                expect(downloadResponse.ok).toBe(true)

                const downloadedBuffer = Buffer.from(await downloadResponse.arrayBuffer())
                expect(fixture.image.checksum).toEqual(Checksum.fromBuffer(downloadedBuffer))
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
                deletedAssetId = fixture.asset.id

                await fixture.httpClient
                    .delete(`/movies/${fixture.createdMovie.id}`)
                    .ok({
                        deletedMovies: expect.arrayContaining([
                            expect.objectContaining({
                                id: fixture.createdMovie.id,
                                title: fixture.createdMovie.title
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
