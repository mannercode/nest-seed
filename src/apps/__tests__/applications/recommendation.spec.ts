import { MovieDto, MovieGenre } from 'apps/cores'
import { createShowingMovies, createWatchedMovies, Fixture } from './recommendation.fixture'

describe('RecommendationService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./recommendation.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('GET /movies/recommended', () => {
        let showingMovies: MovieDto[]

        beforeEach(async () => {
            const { movies } = await createShowingMovies(fix, [
                {
                    title: 'Fantasy',
                    genres: [MovieGenre.Fantasy],
                    releaseDate: new Date('2900-01-01')
                },
                {
                    title: 'Comedy1',
                    genres: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-02-01')
                },
                {
                    title: 'Comedy2',
                    genres: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-03-01')
                },
                {
                    title: 'Action',
                    genres: [MovieGenre.Action],
                    releaseDate: new Date('2900-04-01')
                },
                { title: 'Drama', genres: [MovieGenre.Drama], releaseDate: new Date('2900-05-01') }
            ])

            showingMovies = movies
        })

        // 고객인 경우
        describe('when  the user is a customer', () => {
            let accessToken: string

            beforeEach(async () => {
                const result = await createWatchedMovies(fix, [
                    { title: 'Action1', genres: [MovieGenre.Action] },
                    { title: 'Action2', genres: [MovieGenre.Action] },
                    { title: 'Action3', genres: [MovieGenre.Action] },
                    { title: 'Comedy1', genres: [MovieGenre.Comedy] },
                    { title: 'Comedy2', genres: [MovieGenre.Comedy] },
                    { title: 'Drama1', genres: [MovieGenre.Drama] }
                ])

                accessToken = result.accessToken
            })

            // 고객의 추천 목록을 반환한다
            it('returns recommendations for the customer', async () => {
                await fix.httpClient
                    .get('/movies/recommended')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok([
                        showingMovies[3], // Action
                        showingMovies[1], // Comedy1, 2900-02-01
                        showingMovies[2], // Comedy, 2900-03-01
                        showingMovies[4], // Drama
                        showingMovies[0] // Fantasy
                    ])
            })
        })

        // 손님인 경우
        describe('when  the user is a guest user', () => {
            // 손님의 추천 목록을 반환한다
            it('returns recommendations for guests', async () => {
                await fix.httpClient.get('/movies/recommended').ok([
                    showingMovies[0], // 2900-01-01
                    showingMovies[1], // 2900-02-01
                    showingMovies[2], // 2900-03-01
                    showingMovies[3], // 2900-04-01
                    showingMovies[4] // 2900-05-01
                ])
            })
        })
    })
})
