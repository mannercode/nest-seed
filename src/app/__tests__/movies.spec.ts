import { expect } from '@jest/globals'
import { nullObjectId } from 'common'
import { MovieDto, MovieGenre, MovieRating } from 'services/movies'
import { expectEqualUnsorted, HttpTestClient, objectToFields } from 'testlib'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    createMovie,
    createMovies,
    IsolatedFixture,
    createMovieDto
} from './movies.fixture'

describe('Movies Module', () => {
    let isolated: IsolatedFixture
    let client: HttpTestClient

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        client = isolated.testContext.client
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    describe('POST /movies', () => {
        it('영화를 생성해야 한다', async () => {
            const { createDto, expectedDto } = createMovieDto()
            const body = await createMovie(client, createDto)

            expect(body).toEqual(expectedDto)
        })

        it('허용되지 않은 MIME type의 파일을 업로드 하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            const notAllowFile = './test/fixtures/text.txt'
            const { createDto } = createMovieDto()

            await client
                .post('/movies')
                .attachs([{ name: 'files', file: notAllowFile }])
                .fields(objectToFields(createDto))
                .badRequest()
        })

        it('필수 필드가 누락되면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await client
                .post('/movies')
                .body({})
                .badRequest({
                    error: 'Bad Request',
                    message: [
                        'title should not be empty',
                        'title must be a string',
                        'each value in genre must be one of the following values: Action, Comedy, Drama, Fantasy, Horror, Mystery, Romance, Thriller, Western',
                        'genre must be an array',
                        'releaseDate must be a Date instance',
                        'plot must be shorter than or equal to 5000 characters',
                        'plot must be a string',
                        'durationMinutes must be an integer number',
                        'director must be a string',
                        'rating must be one of the following values: G, PG, PG13, R, NC17'
                    ],
                    statusCode: 400
                })
        })
    })

    describe('PATCH /movies/:id', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(client)
        })

        it('영화 정보를 업데이트해야 한다', async () => {
            const updateDto = {
                title: 'update title',
                genre: ['Romance', 'Thriller'],
                releaseDate: new Date('2000-01-01'),
                plot: `new plot`,
                durationMinutes: 10,
                director: 'Steven Spielberg',
                rating: MovieRating.R
            }
            const expected = { ...movie, ...updateDto }

            await client.patch(`/movies/${movie.id}`).body(updateDto).ok(expected)
            await client.get(`/movies/${movie.id}`).ok(expected)
        })

        it('영화가 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client.patch(`/movies/${nullObjectId}`).body({}).notFound({
                error: 'Not Found',
                message: 'Movie with ID 000000000000000000000000 not found',
                statusCode: 404
            })
        })
    })

    describe('DELETE /movies/:id', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(client)
        })

        it('영화를 삭제해야 한다', async () => {
            await client.delete(`/movies/${movie.id}`).ok()
            await client
                .get(`/movies/${movie.id}`)
                .notFound({
                    error: 'Not Found',
                    message: `Movie with ID ${movie.id} not found`,
                    statusCode: 404
                })
        })

        it('영화가 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client.delete(`/movies/${nullObjectId}`).notFound({
                error: 'Not Found',
                message: 'Movie with ID 000000000000000000000000 not found',
                statusCode: 404
            })
        })
    })

    describe('GET /movies/:id', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(client)
        })

        it('영화 정보를 가져와야 한다', async () => {
            await client.get(`/movies/${movie.id}`).ok(movie)
        })

        it('영화가 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client.get(`/movies/${nullObjectId}`).notFound({
                error: 'Not Found',
                message: 'Movie with ID 000000000000000000000000 not found',
                statusCode: 404
            })
        })
    })

    describe('GET /movies', () => {
        let movies: MovieDto[]

        beforeEach(async () => {
            movies = await createMovies(client)
        })

        it('기본 페이지네이션 설정으로 영화를 가져와야 한다', async () => {
            const { body } = await client.get('/movies').query({ skip: 0 }).ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({
                skip: 0,
                take: expect.any(Number),
                total: movies.length
            })
            expectEqualUnsorted(items, movies)
        })

        it('잘못된 필드로 검색하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await client
                .get('/movies')
                .query({ wrong: 'value' })
                .badRequest({
                    error: 'Bad Request',
                    message: ['property wrong should not exist'],
                    statusCode: 400
                })
        })

        it('제목의 일부로 영화를 검색할 수 있어야 한다', async () => {
            const partialTitle = 'Movie-1'
            const { body } = await client.get('/movies').query({ title: partialTitle }).ok()

            const expected = movies.filter((movie) => movie.title.startsWith(partialTitle))
            expectEqualUnsorted(body.items, expected)
        })

        it('장르로 영화를 검색할 수 있어야 한다', async () => {
            const genre = MovieGenre.Drama
            const { body } = await client.get('/movies').query({ genre }).ok()

            const expected = movies.filter((movie) => movie.genre.includes(genre))
            expectEqualUnsorted(body.items, expected)
        })

        it('개봉일로 영화를 검색할 수 있어야 한다', async () => {
            const releaseDate = movies[0].releaseDate
            const { body } = await client.get('/movies').query({ releaseDate }).ok()

            const expected = movies.filter(
                (movie) => movie.releaseDate.getTime() === releaseDate.getTime()
            )
            expectEqualUnsorted(body.items, expected)
        })

        it('줄거리의 일부로 영화를 검색할 수 있어야 한다', async () => {
            const partialPlot = 'plot-01'
            const { body } = await client.get('/movies').query({ plot: partialPlot }).ok()

            const expected = movies.filter((movie) => movie.plot.startsWith(partialPlot))
            expectEqualUnsorted(body.items, expected)
        })

        it('감독의 일부로 영화를 검색할 수 있어야 한다', async () => {
            const partialDirector = 'James'
            const { body } = await client.get('/movies').query({ director: partialDirector }).ok()

            const expected = movies.filter((movie) => movie.director.startsWith(partialDirector))
            expectEqualUnsorted(body.items, expected)
        })

        it('등급으로 영화를 검색할 수 있어야 한다', async () => {
            const rating = MovieRating.NC17
            const { body } = await client.get('/movies').query({ rating }).ok()

            const expected = movies.filter((movie) => movie.rating === rating)
            expectEqualUnsorted(body.items, expected)
        })
    })
})
