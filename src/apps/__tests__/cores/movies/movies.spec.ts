import type { MovieDto, SearchMoviesPageDto } from 'apps/cores'
import {
    buildCreateMovieDto,
    createMovie,
    Errors,
    testAssets,
    uploadAndFinalizeAsset
} from 'apps/__tests__/__helpers__'
import { MovieGenre, MovieRating } from 'apps/cores'
import { Checksum } from 'common'
import { omit } from 'lodash'
import { Rules } from 'shared'
import { nullObjectId } from 'testlib'
import type { MoviesFixture } from './movies.fixture'

describe('MoviesService', () => {
    let fix: MoviesFixture

    beforeEach(async () => {
        const { createMoviesFixture } = await import('./movies.fixture')
        fix = await createMoviesFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movies', () => {
        // 생성된 영화를 반환한다
        it('returns the created movie', async () => {
            const createDto = buildCreateMovieDto()

            await fix.httpClient
                .post('/movies')
                .body(createDto)
                .created({
                    ...omit(createDto, ['assetIds']),
                    id: expect.any(String),
                    imageUrls: []
                })
        })

        // 필수 필드가 누락되었을 때
        describe('when required fields are missing', () => {
            // 기본값으로 생성된 영화를 반환한다.
            it('returns the created movie with defaults', async () => {
                await fix.httpClient
                    .post('/movies')
                    .body({})
                    .created({
                        genres: [],
                        id: expect.any(String),
                        imageUrls: [],
                        ...Rules.Movie.defaults
                    })
            })
        })
    })

    describe('GET /movies/:id', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 영화를 반환한다
            it('returns the movie', async () => {
                await fix.httpClient.get(`/movies/${movie.id}`).ok(movie)
            })
        })

        // 영화가 이미지를 포함할 때
        describe('when the movie has images', () => {
            let movie: MovieDto

            beforeEach(async () => {
                const asset = await uploadAndFinalizeAsset(fix, testAssets.image)
                movie = await createMovie(fix, { assetIds: [asset.id] })
            })

            // 업로드된 에셋에 대한 imageUrls를 반환한다
            it('returns imageUrls for the uploaded asset', async () => {
                const response = await fetch(movie.imageUrls[0])
                expect(response.ok).toBe(true)

                const buffer = Buffer.from(await response.bytes())
                expect(testAssets.image.checksum).toEqual(Checksum.fromBuffer(buffer))
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/movies/${nullObjectId}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
            })
        })
    })

    describe('PATCH /movies/:id', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix, { title: 'original-title' })
            })

            // 수정된 영화를 반환한다
            it('returns the updated movie', async () => {
                const updateDto = {
                    assetIds: [],
                    director: 'Steven Spielberg',
                    durationInSeconds: 10 * 60,
                    genres: ['romance', 'thriller'],
                    plot: 'new plot',
                    rating: 'R',
                    releaseDate: new Date('2000-01-01')
                }

                await fix.httpClient
                    .patch(`/movies/${movie.id}`)
                    .body(updateDto)
                    .ok({ ...movie, ...omit(updateDto, ['assetIds']) })
            })

            // 수정 내용이 저장된다
            it('persists the update', async () => {
                const updateDto = { title: 'update title' }
                await fix.httpClient.patch(`/movies/${movie.id}`).body(updateDto).ok()

                await fix.httpClient.get(`/movies/${movie.id}`).ok({ ...movie, ...updateDto })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/movies/${nullObjectId}`)
                    .body({})
                    .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
            })
        })
    })

    describe('DELETE /movies/:id', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()

                await fix.httpClient
                    .get(`/movies/${movie.id}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([movie.id]))
            })
        })

        // 영화가 이미지를 포함할 때
        describe('when the movie has images', () => {
            let movie: MovieDto

            beforeEach(async () => {
                const asset = await uploadAndFinalizeAsset(fix, testAssets.image)
                movie = await createMovie(fix, { assetIds: [asset.id] })
            })

            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()
            })

            // 이미지 URL을 무효화한다
            it('invalidates image URL', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()

                const response = await fetch(movie.imageUrls[0])
                expect(response.status).toBe(404)
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movies/${nullObjectId}`).noContent()
            })
        })
    })

    describe('GET /movies', () => {
        let movieA1: MovieDto
        let movieA2: MovieDto
        let movieB1: MovieDto
        let movieB2: MovieDto

        beforeEach(async () => {
            const asset = await uploadAndFinalizeAsset(fix, testAssets.image)

            const createdMovies = await Promise.all([
                createMovie(fix, {
                    assetIds: [asset.id],
                    director: 'James Cameron',
                    genres: [MovieGenre.Action, MovieGenre.Comedy],
                    plot: 'plot-a1',
                    rating: MovieRating.NC17,
                    releaseDate: new Date('2000-01-01'),
                    title: 'title-a1'
                }),
                createMovie(fix, {
                    director: 'Steven Spielberg',
                    genres: [MovieGenre.Romance, MovieGenre.Drama],
                    plot: 'plot-a2',
                    rating: MovieRating.NC17,
                    releaseDate: new Date('2000-01-02'),
                    title: 'title-a2'
                }),
                createMovie(fix, {
                    director: 'James Cameron',
                    genres: [MovieGenre.Drama, MovieGenre.Comedy],
                    plot: 'plot-b1',
                    rating: MovieRating.PG,
                    releaseDate: new Date('2000-01-02'),
                    title: 'title-b1'
                }),
                createMovie(fix, {
                    director: 'Steven Spielberg',
                    genres: [MovieGenre.Thriller, MovieGenre.Western],
                    plot: 'plot-b2',
                    rating: MovieRating.R,
                    releaseDate: new Date('2000-01-03'),
                    title: 'title-b2'
                })
            ])

            movieA1 = createdMovies[0]
            movieA2 = createdMovies[1]
            movieB1 = createdMovies[2]
            movieB2 = createdMovies[3]
        })

        const buildExpectedPage = (movies: MovieDto[]) => {
            movies.forEach((movie) => (movie.imageUrls = expect.any(Array)))
            return {
                items: expect.arrayContaining(movies),
                skip: 0,
                take: expect.any(Number),
                total: movies.length
            }
        }

        // 쿼리가 제공되지 않을 때
        describe('when the query is not provided', () => {
            // 기본 페이지를 반환한다
            it('returns the default page', async () => {
                const expected = buildExpectedPage([movieA1, movieA2, movieB1, movieB2])

                await fix.httpClient.get('/movies').ok(expected)
            })
        })

        // 필터가 제공될 때
        describe('when the filter is provided', () => {
            const queryAndExpect = (query: SearchMoviesPageDto, movies: MovieDto[]) =>
                fix.httpClient.get('/movies').query(query).ok(buildExpectedPage(movies))

            // 부분 제목 일치로 필터링된 영화를 반환한다
            it('returns movies filtered by a partial title match', async () => {
                await queryAndExpect({ title: 'title-a' }, [movieA1, movieA2])
            })

            // 장르로 필터링된 영화를 반환한다
            it('returns movies filtered by genre', async () => {
                await queryAndExpect({ genre: MovieGenre.Drama }, [movieA2, movieB1])
            })

            // 개봉일로 필터링된 영화를 반환한다
            it('returns movies filtered by release date', async () => {
                await queryAndExpect({ releaseDate: new Date('2000-01-02') }, [movieA2, movieB1])
            })

            // 부분 줄거리 일치로 필터링된 영화를 반환한다
            it('returns movies filtered by a partial plot match', async () => {
                await queryAndExpect({ plot: 'plot-b' }, [movieB1, movieB2])
            })

            // 부분 감독 이름 일치로 필터링된 영화를 반환한다
            it('returns movies filtered by a partial director name match', async () => {
                await queryAndExpect({ director: 'James' }, [movieA1, movieB1])
            })

            // 등급으로 필터링된 영화를 반환한다
            it('returns movies filtered by rating', async () => {
                await queryAndExpect({ rating: MovieRating.NC17 }, [movieA1, movieA2])
            })
        })

        // 쿼리 파라미터가 유효하지 않을 때
        describe('when the query parameters are invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/movies')
                    .query({ wrong: 'value' })
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })
    })
})
