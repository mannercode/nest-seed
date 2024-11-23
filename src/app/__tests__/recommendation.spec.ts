import { MovieDto, MovieGenre } from 'services/movies'
import { HttpTestClient, nullObjectId } from 'testlib'
import { createMovie } from './movies.fixture'
import { closeFixture, createFixture, Fixture } from './recommendation.fixture'
import { createShowtimes } from './showtimes.fixture'

describe.skip('Recommendation Module', () => {
    let fixture: Fixture
    let client: HttpTestClient

    beforeEach(async () => {
        fixture = await createFixture()
        client = fixture.testContext.client
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    describe('추천 영화 목록 요청', () => {
        const customerId = '100000000000000000000001'
        let showingMovies: MovieDto[]
        let expectedRecommendedMovies: MovieDto[]

        const createWatchedMovies = async (watchedMovies: MovieDto[]) => {
            await Promise.all(
                watchedMovies.map((movie) =>
                    fixture.watchRecordsService.createWatchRecord({
                        customerId,
                        purchaseId: '100000000000000000000001',
                        watchDate: new Date(0),
                        movieId: movie.id
                    })
                )
            )
        }

        const createShowingMovies = async (showingMovies: MovieDto[]) => {
            const showtimesCreateDtos = showingMovies.map((movie) => ({
                movieId: movie.id,
                batchId: nullObjectId,
                theaterId: nullObjectId,
                startTime: new Date('2999-01-01'),
                endTime: new Date('2999-01-02')
            }))

            await createShowtimes(fixture.showtimesService, showtimesCreateDtos)
        }

        beforeEach(async () => {
            const service = fixture.moviesService
            const watchedMovies = [
                await createMovie(service, { title: 'Action1', genre: [MovieGenre.Action] }),
                await createMovie(service, { title: 'Action2', genre: [MovieGenre.Action] }),
                await createMovie(service, { title: 'Action3', genre: [MovieGenre.Action] }),
                await createMovie(service, { title: 'Comedy1', genre: [MovieGenre.Comedy] }),
                await createMovie(service, { title: 'Comedy2', genre: [MovieGenre.Comedy] }),
                await createMovie(service, { title: 'Drama1', genre: [MovieGenre.Drama] })
            ]

            await createWatchedMovies(watchedMovies)

            showingMovies = [
                await createMovie(service, { title: 'Fantasy', genre: [MovieGenre.Fantasy] }),
                await createMovie(service, {
                    title: 'Comedy1',
                    genre: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-01-01')
                }),
                await createMovie(service, {
                    title: 'Comedy2',
                    genre: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-02-01')
                }),
                await createMovie(service, { title: 'Action', genre: [MovieGenre.Action] }),
                await createMovie(service, { title: 'Drama', genre: [MovieGenre.Drama] })
            ]

            await createShowingMovies(showingMovies)

            expectedRecommendedMovies = [
                showingMovies[3],
                showingMovies[2],
                showingMovies[1],
                showingMovies[4],
                showingMovies[0]
            ]
        })

        it('가장 많이 관람한 genre, 최신 개봉일 순서로 추천 영화 목록을 반환해야 한다', async () => {
            const { body } = await client.get('/movies/recommended').ok()

            const { items, ...paginated } = body

            expect(paginated).toEqual({
                skip: 0,
                take: expectedRecommendedMovies.length,
                total: showingMovies.length
            })
            expect(items).toEqual(expectedRecommendedMovies)
        })
    })
})
