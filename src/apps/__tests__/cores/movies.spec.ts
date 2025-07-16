import { MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { Path, pickIds } from 'common'
import { expectEqualUnsorted, nullObjectId, objectToFields } from 'testlib'
import { Errors } from '../__helpers__'
import { buildCreateMovieDto, createMovie } from '../common.fixture'
import { Fixture } from './movies.fixture'

describe('Movies', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./movies.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /movies', () => {
        // 영화를 생성해야 한다
        it('Should create a movie', async () => {
            const { createDto, expectedDto } = buildCreateMovieDto()

            const { body } = await fix.httpClient
                .post('/movies')
                .attachments([{ name: 'files', file: fix.image.path }])
                .fields(objectToFields(createDto))
                .created()

            expect(body).toEqual(expectedDto)
        })

        // 필수 필드가 누락되면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if required fields are missing', async () => {
            await fix.httpClient
                .post('/movies')
                .body({})
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })
    })

    describe('PATCH /movies/:id', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix)
        })

        // 영화 정보를 업데이트해야 한다
        it('Should update movie details', async () => {
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

        it('dummy test for coverage', async () => {
            await fix.httpClient.patch(`/movies/${movie.id}`).body({}).ok(movie)
        })

        // 영화가 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the movie does not exist', async () => {
            await fix.httpClient
                .patch(`/movies/${nullObjectId}`)
                .body({})
                .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
        })
    })

    describe('DELETE /movies/:id', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix)
        })

        // 영화를 삭제해야 한다
        it('Should delete the movie', async () => {
            await fix.httpClient.delete(`/movies/${movie.id}`).ok()
            await fix.httpClient
                .get(`/movies/${movie.id}`)
                .notFound({ ...Errors.Mongoose.MultipleDocumentsNotFound, notFoundIds: [movie.id] })
        })

        // 영화를 삭제하면 파일도 삭제되어야 한다
        it('Should delete the file if the movie is deleted', async () => {
            const fileUrl = movie.images[0]
            const fileId = Path.basename(fileUrl)

            await fix.httpClient.delete(`/movies/${movie.id}`).ok()
            await fix.httpClient
                .get(fileUrl)
                .notFound({ ...Errors.Mongoose.MultipleDocumentsNotFound, notFoundIds: [fileId] })
        })

        // 영화가 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the movie does not exist', async () => {
            await fix.httpClient.delete(`/movies/${nullObjectId}`).notFound({
                ...Errors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: [nullObjectId]
            })
        })
    })

    describe('GET /movies/:id', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix)
        })

        // 영화 상세 정보를 반환해야 한다
        it('Should return movie details', async () => {
            await fix.httpClient.get(`/movies/${movie.id}`).ok(movie)
        })

        // 영화가 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the movie does not exist', async () => {
            await fix.httpClient.get(`/movies/${nullObjectId}`).notFound({
                ...Errors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: [nullObjectId]
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

        // 기본 페이지네이션으로 영화 목록을 반환해야 한다
        it('Should return movies with default pagination', async () => {
            const { body } = await fix.httpClient.get('/movies').query({ skip: 0 }).ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({
                skip: 0,
                take: expect.any(Number),
                total: movies.length
            })
            expectEqualUnsorted(items, movies)
        })

        // 잘못된 필드로 검색하면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if an invalid field is used for search', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ wrong: 'value' })
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })

        // 제목의 일부로 영화 목록을 반환해야 한다
        it('Should return movies filtered by partial title', async () => {
            const { body } = await fix.httpClient.get('/movies').query({ title: 'title-a' }).ok()

            expectEqualUnsorted(body.items, [movies[0], movies[1]])
        })

        // 장르로 영화 목록을 반환해야 한다
        it('Should return movies filtered by genre', async () => {
            const { body } = await fix.httpClient
                .get('/movies')
                .query({ genre: MovieGenre.Drama })
                .ok()

            expectEqualUnsorted(body.items, [movies[1], movies[2]])
        })

        // 개봉일로 영화 목록을 반환해야 한다
        it('Should return movies filtered by release date', async () => {
            const { body } = await fix.httpClient
                .get('/movies')
                .query({ releaseDate: new Date('2000-01-02') })
                .ok()

            expectEqualUnsorted(body.items, [movies[1], movies[2]])
        })

        // 줄거리의 일부로 영화 목록을 반환해야 한다
        it('Should return movies filtered by partial plot', async () => {
            const { body } = await fix.httpClient.get('/movies').query({ plot: 'plot-b' }).ok()

            expectEqualUnsorted(body.items, [movies[2], movies[3]])
        })

        // 감독의 일부로 영화 목록을 반환해야 한다
        it('Should return movies filtered by partial director name', async () => {
            const { body } = await fix.httpClient.get('/movies').query({ director: 'James' }).ok()

            expectEqualUnsorted(body.items, [movies[0], movies[2]])
        })

        // 등급으로 영화 목록을 반환해야 한다
        it('Should return movies filtered by rating', async () => {
            const { body } = await fix.httpClient
                .get('/movies')
                .query({ rating: MovieRating.NC17 })
                .ok()

            expectEqualUnsorted(body.items, [movies[0], movies[1]])
        })
    })

    describe('getMoviesByIds', () => {
        let movies: MovieDto[]

        beforeEach(async () => {
            movies = await Promise.all([
                createMovie(fix),
                createMovie(fix),
                createMovie(fix),
                createMovie(fix),
                createMovie(fix)
            ])
        })

        // 주어진 movieIds의 영화를 반환해야 한다
        it('Should return movies for given movieIds', async () => {
            const expectedMovies = movies.slice(0, 3)
            const movieIds = pickIds(expectedMovies)

            const gotMovies = await fix.moviesClient.getMoviesByIds(movieIds)

            expectEqualUnsorted(gotMovies, expectedMovies)
        })

        // 영화가 존재하지 않으면 NotFoundException을 던져야 한다
        it('Should throw NotFoundException if any movie does not exist', async () => {
            const promise = fix.moviesClient.getMoviesByIds([nullObjectId])

            await expect(promise).rejects.toThrow('One or more documents not found')
        })
    })
})
