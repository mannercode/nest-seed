import { MovieDto, MovieGenre } from 'services/cores'
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

    describe('/movies/recommended', () => {
        let showingMovies: MovieDto[]

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
                {
                    title: 'Fantasy',
                    genre: [MovieGenre.Fantasy],
                    releaseDate: new Date('2900-01-01')
                },
                {
                    title: 'Comedy1',
                    genre: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-02-01')
                },
                {
                    title: 'Comedy2',
                    genre: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-03-01')
                },
                {
                    title: 'Action',
                    genre: [MovieGenre.Action],
                    releaseDate: new Date('2900-04-01')
                },
                {
                    title: 'Drama',
                    genre: [MovieGenre.Drama],
                    releaseDate: new Date('2900-05-01')
                }
            ])
        })

        it('고객이 가장 많이 관람한 genre, 최신 개봉일 순서로 추천 영화 목록을 반환해야 한다', async () => {
            const { body } = await client
                .get('/movies/recommended')
                .headers({ Authorization: `Bearer ${fixture.accessToken}` })
                .ok()

            expect(body).toEqual([
                showingMovies[3], // Action
                showingMovies[2], // Comedy2, 2900-03-01
                showingMovies[1], // Comedy1, 2900-02-01
                showingMovies[4], // Drama
                showingMovies[0] // Fantasy
            ])
        })

        it('로그인을 하지 않으면 최신 개봉일 순서로 추천 영화 목록을 반환해야 한다', async () => {
            const { body } = await client.get('/movies/recommended').ok()

            expect(body).toEqual([
                showingMovies[4], // 2900-05-01
                showingMovies[3], // 2900-04-01
                showingMovies[2], // 2900-03-01
                showingMovies[1], // 2900-02-01
                showingMovies[0] // 2900-01-01
            ])
        })
    })
})
