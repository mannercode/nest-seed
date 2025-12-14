import { CreateMovieDto, MovieDto, MovieGenre, MovieRating, SearchMoviesPageDto } from 'apps/cores'
import { AssetDto } from 'apps/infrastructures'
import { Checksum } from 'common'
import { omit } from 'lodash'
import { nullObjectId } from 'testlib'
import {
    buildCreateMovieDto,
    createMovie,
    Errors,
    fixtureFiles,
    uploadComplete
} from '../__helpers__'
import type { MoviesFixture } from './movies.fixture'

describe('MoviesService', () => {
    let fix: MoviesFixture

    beforeEach(async () => {
        const { createMoviesFixture } = await import('./movies.fixture')
        fix = await createMoviesFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /movies', () => {
        it('returns 201 with the created movie', async () => {
            const payload = buildCreateMovieDto()

            await fix.httpClient
                .post('/movies')
                .body(payload)
                .created({
                    ...omit(payload, ['assetIds']),
                    id: expect.any(String),
                    imageUrls: expect.any(Array)
                })
        })

        describe('when the payload includes assetIds', () => {
            let payload: CreateMovieDto
            let asset: AssetDto

            beforeEach(async () => {
                asset = await uploadComplete(fix, fixtureFiles.image)
                payload = buildCreateMovieDto({ assetIds: [asset.id] })
            })

            it('returns imageUrls for the uploaded asset', async () => {
                const { body } = await fix.httpClient.post('/movies').body(payload).created()
                const movie = body as MovieDto

                const response = await fetch(movie.imageUrls[0])
                expect(response.ok).toBe(true)

                const buffer = Buffer.from(await response.bytes())
                expect(asset.checksum).toEqual(Checksum.fromBuffer(buffer))
            })
        })

        it('returns 400 Bad Request for missing required fields', async () => {
            await fix.httpClient
                .post('/movies')
                .body({})
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })
    })

    describe('GET /movies/:id', () => {
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            it('returns 200 with the movie', async () => {
                await fix.httpClient.get(`/movies/${movie.id}`).ok(movie)
            })
        })

        it('returns 404 Not Found for a non-existent movie', async () => {
            await fix.httpClient
                .get(`/movies/${nullObjectId}`)
                .notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
        })
    })

    describe('PATCH /movies/:id', () => {
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            it('returns 200 with the updated movie', async () => {
                const payload = {
                    title: 'update title',
                    genres: ['romance', 'thriller'],
                    releaseDate: new Date('2000-01-01'),
                    plot: 'new plot',
                    durationInSeconds: 10 * 60,
                    director: 'Steven Spielberg',
                    rating: 'R'
                }

                await fix.httpClient
                    .patch(`/movies/${movie.id}`)
                    .body(payload)
                    .ok({ ...movie, ...payload })
            })

            it('persists the update', async () => {
                const payload = { title: 'update title' }
                await fix.httpClient.patch(`/movies/${movie.id}`).body(payload).ok()

                await fix.httpClient.get(`/movies/${movie.id}`).ok({ ...movie, ...payload })
            })
        })

        it('returns 404 Not Found for a non-existent movie', async () => {
            await fix.httpClient
                .patch(`/movies/${nullObjectId}`)
                .body({})
                .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
        })
    })

    describe('DELETE /movies/:id', () => {
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                const asset = await uploadComplete(fix, fixtureFiles.image)
                movie = await createMovie(fix, { assetIds: [asset.id] })
            })

            it('returns 200 with the deleted movie', async () => {
                await fix.httpClient
                    .delete(`/movies/${movie.id}`)
                    .ok({ deletedMovies: [{ ...movie, imageUrls: [] }] })

                await fix.httpClient
                    .get(`/movies/${movie.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [movie.id]
                    })
            })

            it('makes the movie image URL inaccessible after deletion', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).ok()

                const response = await fetch(movie.imageUrls[0])
                expect(response.ok).toBe(false)
            })
        })

        it('returns 404 Not Found for a non-existent movie', async () => {
            await fix.httpClient
                .delete(`/movies/${nullObjectId}`)
                .notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
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

        const buildExpectedPage = (movies: MovieDto[]) => ({
            skip: 0,
            take: expect.any(Number),
            total: movies.length,
            items: expect.arrayContaining(movies)
        })

        it('returns 200 with the default page of movies when no query parameters are provided', async () => {
            const expected = buildExpectedPage([movieA1, movieA2, movieB1, movieB2])

            await fix.httpClient.get('/movies').ok(expected)
        })

        describe('when query parameters are provided', () => {
            const queryAndExpect = (query: SearchMoviesPageDto, movies: MovieDto[]) =>
                fix.httpClient.get('/movies').query(query).ok(buildExpectedPage(movies))

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

        it('returns 400 Bad Request for invalid query parameters', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ wrong: 'value' })
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })
    })
})
