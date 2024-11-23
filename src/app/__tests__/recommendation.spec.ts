import { MovieDto, MovieGenre } from 'services/movies'
import { HttpTestClient } from 'testlib'
import {
    closeFixture,
    createFixture,
    createShowingMovies,
    createWatchedMovies,
    Fixture
} from './recommendation.fixture'

describe('Recommendation Module', () => {
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
        let showingMovies: MovieDto[]
        let expectedRecommendedMovies: MovieDto[]

        beforeEach(async () => {
            await createWatchedMovies(fixture, [
                { title: 'Action1', genre: [MovieGenre.Action] },
                { title: 'Action2', genre: [MovieGenre.Action] },
                { title: 'Action3', genre: [MovieGenre.Action] },
                { title: 'Comedy1', genre: [MovieGenre.Comedy] },
                { title: 'Comedy2', genre: [MovieGenre.Comedy] },
                { title: 'Drama1', genre: [MovieGenre.Drama] }
            ])

            showingMovies = await createShowingMovies(fixture, [
                { title: 'Fantasy', genre: [MovieGenre.Fantasy] },
                {
                    title: 'Comedy1',
                    genre: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-01-01')
                },
                {
                    title: 'Comedy2',
                    genre: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-02-01')
                },
                { title: 'Action', genre: [MovieGenre.Action] },
                { title: 'Drama', genre: [MovieGenre.Drama] }
            ])

            expectedRecommendedMovies = [
                showingMovies[3],
                showingMovies[2],
                showingMovies[1],
                showingMovies[4],
                showingMovies[0]
            ]
        })

        it('가장 많이 관람한 genre, 최신 개봉일 순서로 추천 영화 목록을 반환해야 한다', async () => {
            const { body } = await client
                .get('/movies/recommended')
                .headers({ Authorization: `Bearer ${fixture.accessToken}` })
                .ok()

            const { items, ...paginated } = body

            expect(paginated).toEqual({
                skip: 0,
                take: expectedRecommendedMovies.length,
                total: showingMovies.length
            })
            expect(items).toEqual(expectedRecommendedMovies)
        })

        it('로그인을 하지 않아도 추천 영화 목록을 반환해야 한다', async () => {
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
