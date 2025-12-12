import { CreateMovieDto, MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { AssetDto } from 'apps/infrastructures'
import { Checksum } from 'common'
import { nullObjectId } from 'testlib'
import {
    buildCreateMovieDto,
    createMovie,
    Errors,
    fixtureFiles,
    uploadComplete
} from '../__helpers__'
import type { MoviesFixture } from './movies.fixture'
import { omit } from 'lodash'

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
            const payload = buildCreateMovieDto()

            it('returns 201 with the created movie', async () => {
                await fixture.httpClient
                    .post('/movies')
                    .body(payload)
                    .created({
                        ...omit(payload, ['assetIds']),
                        id: expect.any(String),
                        imageUrls: []
                    })
            })
        })

        describe('when the payload includes assetIds', () => {
            let payload: CreateMovieDto
            let asset: AssetDto

            beforeEach(async () => {
                asset = await uploadComplete(fixture, fixtureFiles.image)
                payload = buildCreateMovieDto({ assetIds: [asset.id] })
            })

            it('returns imageUrls for the uploaded asset', async () => {
                const { body } = await fixture.httpClient.post('/movies').body(payload).created()
                const movie = body as MovieDto

                const response = await fetch(movie.imageUrls[0])
                expect(response.ok).toBe(true)

                const buffer = Buffer.from(await response.bytes())
                expect(asset.checksum).toEqual(Checksum.fromBuffer(buffer))
            })
        })

        describe('when the required fields are missing', () => {
            const invalidPayload = {}

            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/movies')
                    .body(invalidPayload)
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /movies/:id', () => {
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fixture)
            })

            it('returns 200 with the movie', async () => {
                await fixture.httpClient.get(`/movies/${movie.id}`).ok(movie)
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
            let movie: MovieDto
            let payload: any

            beforeEach(async () => {
                movie = await createMovie(fixture)
                payload = {
                    title: 'update title',
                    genres: ['romance', 'thriller'],
                    releaseDate: new Date('2000-01-01'),
                    plot: 'new plot',
                    durationInSeconds: 10 * 60,
                    director: 'Steven Spielberg',
                    rating: 'R'
                }
            })

            it('returns 200 with the updated movie', async () => {
                const expected = { ...movie, ...payload }

                await fixture.httpClient.patch(`/movies/${movie.id}`).body(payload).ok(expected)
                await fixture.httpClient.get(`/movies/${movie.id}`).ok(expected)
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
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                const asset = await uploadComplete(fixture, fixtureFiles.image)
                movie = await createMovie(fixture, { assetIds: [asset.id] })
            })

            it('returns 200 with the deleted movie', async () => {
                await fixture.httpClient
                    .delete(`/movies/${movie.id}`)
                    .ok({ deletedMovies: [{ ...movie, imageUrls: [] }] })

                await fixture.httpClient
                    .get(`/movies/${movie.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [movie.id]
                    })
            })

            it('makes the movie image URL inaccessible after deletion', async () => {
                await fixture.httpClient.delete(`/movies/${movie.id}`).ok()

                const response = await fetch(movie.imageUrls[0])
                expect(response.ok).toBe(false)
            })
        })

        describe('when the movie does not exist', () => {
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
        let movieA1: MovieDto
        let movieA2: MovieDto
        let movieB1: MovieDto
        let movieB2: MovieDto

        beforeEach(async () => {
            ;[movieA1, movieA2, movieB1, movieB2] = await Promise.all([
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
        })

        const buildExpectedPage = (movies: MovieDto[]) => ({
            skip: 0,
            take: expect.any(Number),
            total: movies.length,
            items: expect.arrayContaining(movies)
        })

        describe('when no query parameters are provided', () => {
            it('returns 200 with the default page of movies', async () => {
                const expected = buildExpectedPage([movieA1, movieA2, movieB1, movieB2])

                await fixture.httpClient.get('/movies').ok(expected)
            })
        })

        describe('when query parameters are provided', () => {
            const queryAndExpect = (query: any, movies: MovieDto[]) =>
                fixture.httpClient.get('/movies').query(query).ok(buildExpectedPage(movies))

            it('returns movies filtered by a partial title match', async () => {
                await queryAndExpect({ title: 'title-a' }, [movieA1, movieA2])
            })

            it('returns movies filtered by genre', async () => {
                await queryAndExpect({ genre: MovieGenre.Drama }, [movieA2, movieB1])
            })

            it('returns movies filtered by release date', async () => {
                await queryAndExpect({ releaseDate: new Date('2000-01-02') }, [movieA2, movieB1])
            })

            it('returns movies filtered by a partial plot match', async () => {
                await queryAndExpect({ plot: 'plot-b' }, [movieB1, movieB2])
            })

            it('returns movies filtered by a partial director name match', async () => {
                await queryAndExpect({ director: 'James' }, [movieA1, movieB1])
            })

            it('returns movies filtered by rating', async () => {
                await queryAndExpect({ rating: MovieRating.NC17 }, [movieA1, movieA2])
            })
        })

        describe('when query parameters are invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/movies')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })
})
