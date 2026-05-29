import { Checksum, ensure, omit } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { MovieDefaults, MovieGenre, MovieRating, type MovieDto } from 'core'
import {
    buildCreateMovieDto,
    createMovie,
    Errors,
    testAssets,
    uploadAndFinalizeAsset,
    type AppTestContext
} from '../helpers'

describe('MoviesService', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { AdminAuthGuard } = await import('gateway')
        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
    })
    afterEach(() => fix.teardown())

    describe('POST /movies', () => {
        it('생성된 영화를 반환한다', async () => {
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

        it('필드를 비워 보내면 기본값이 적용된 영화를 반환한다', async () => {
            await fix.httpClient
                .post('/movies')
                .body({})
                .created({ genres: [], id: expect.any(String), imageUrls: [], ...MovieDefaults })
        })
    })

    describe('GET /movies/:id', () => {
        it('ID에 해당하는 영화를 반환한다', async () => {
            const movie = await createMovie(fix)

            await fix.httpClient.get(`/movies/${movie.id}`).ok(movie)
        })

        describe('이미지가 있을 때', () => {
            let movie: MovieDto

            beforeEach(async () => {
                const asset = await uploadAndFinalizeAsset(fix, testAssets.image)
                movie = await createMovie(fix, { assetIds: [asset.id] })
            })

            it('imageUrls로 이미지를 다운로드할 수 있다', async () => {
                const response = await fetch(ensure(movie.imageUrls[0]))
                expect(response.ok).toBe(true)

                const buffer = Buffer.from(await response.bytes())
                expect(testAssets.image.checksum).toEqual(Checksum.fromBuffer(buffer))
            })
        })

        it('ID에 해당하는 영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/movies/${nullObjectId}`)
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
        })
    })

    describe('PATCH /movies/:id', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix, { title: 'original-title' })
        })

        it('수정된 영화를 반환한다', async () => {
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

        it('수정 내용이 DB에 저장된다', async () => {
            const updateDto = { title: 'update title' }
            await fix.httpClient.patch(`/movies/${movie.id}`).body(updateDto).ok()

            await fix.httpClient.get(`/movies/${movie.id}`).ok({ ...movie, ...updateDto })
        })

        it('ID에 해당하는 영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .patch(`/movies/${nullObjectId}`)
                .body({})
                .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
        })
    })

    describe('DELETE /movies/:id', () => {
        it('영화가 존재하면 204를 반환한다', async () => {
            const movie = await createMovie(fix)

            await fix.httpClient.delete(`/movies/${movie.id}`).noContent()
        })

        it('삭제 후에는 조회 시 404가 반환된다', async () => {
            const movie = await createMovie(fix)

            await fix.httpClient.delete(`/movies/${movie.id}`).noContent()

            await fix.httpClient
                .get(`/movies/${movie.id}`)
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([movie.id]))
        })

        describe('이미지가 있는 영화를 삭제할 때', () => {
            let movie: MovieDto

            beforeEach(async () => {
                const asset = await uploadAndFinalizeAsset(fix, testAssets.image)
                movie = await createMovie(fix, { assetIds: [asset.id] })
            })

            it('204를 반환한다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()
            })

            it('이미지 URL이 무효화된다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()

                const response = await fetch(ensure(movie.imageUrls[0]))
                expect(response.status).toBe(404)
            })
        })

        it('영화가 없어도 204를 반환한다', async () => {
            await fix.httpClient.delete(`/movies/${nullObjectId}`).noContent()
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
            const expectedItems = movies.map((movie) => ({
                ...movie,
                imageUrls: movie.id === movieA1.id ? [expect.any(String)] : []
            }))
            return {
                items: expect.arrayContaining(expectedItems),
                page: expect.any(Number),
                size: expect.any(Number),
                total: movies.length
            }
        }

        it('쿼리가 없으면 전체 영화 페이지를 반환한다', async () => {
            const expected = buildExpectedPage([movieA1, movieA2, movieB1, movieB2])

            await fix.httpClient.get('/movies').ok(expected)
        })

        it('title 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ title: 'title-a' })
                .ok(buildExpectedPage([movieA1, movieA2]))
        })

        it('genre로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ genre: MovieGenre.Drama })
                .ok(buildExpectedPage([movieA2, movieB1]))
        })

        it('개봉일로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ releaseDate: new Date('2000-01-02') })
                .ok(buildExpectedPage([movieA2, movieB1]))
        })

        it('plot 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ plot: 'plot-b' })
                .ok(buildExpectedPage([movieB1, movieB2]))
        })

        it('director 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ director: 'James' })
                .ok(buildExpectedPage([movieA1, movieB1]))
        })

        it('rating으로 필터링한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ rating: MovieRating.NC17 })
                .ok(buildExpectedPage([movieA1, movieA2]))
        })

        it('알 수 없는 쿼리 파라미터는 400을 반환한다', async () => {
            await fix.httpClient
                .get('/movies')
                .query({ wrong: 'value' })
                .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
        })
    })
})
