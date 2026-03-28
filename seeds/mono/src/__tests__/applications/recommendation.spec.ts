import type { MovieDto } from 'cores'
import { MovieGenre } from 'cores'
import type { RecommendationFixture } from './recommendation.fixture'
import { createShowingMovies, createWatchedMovies } from './recommendation.fixture'

describe('RecommendationService', () => {
    let fix: RecommendationFixture

    beforeEach(async () => {
        const { createRecommendationFixture } = await import('./recommendation.fixture')
        fix = await createRecommendationFixture()
    })
    afterEach(() => fix.teardown())

    describe('GET /movies/recommended', () => {
        // 상영 중인 영화가 존재할 때
        describe('when showing movies exist', () => {
            let fantasyMovie: MovieDto
            let comedy1Movie: MovieDto
            let comedy2Movie: MovieDto
            let actionMovie: MovieDto
            let dramaMovie: MovieDto

            beforeEach(async () => {
                const showingMovies = await createShowingMovies(fix, [
                    { genres: [MovieGenre.Fantasy], releaseDate: new Date('2900-01-01') },
                    { genres: [MovieGenre.Comedy], releaseDate: new Date('2900-02-01') },
                    { genres: [MovieGenre.Comedy], releaseDate: new Date('2900-03-01') },
                    { genres: [MovieGenre.Action], releaseDate: new Date('2900-04-01') },
                    { genres: [MovieGenre.Drama], releaseDate: new Date('2900-05-01') }
                ])

                fantasyMovie = showingMovies[0]
                comedy1Movie = showingMovies[1]
                comedy2Movie = showingMovies[2]
                actionMovie = showingMovies[3]
                dramaMovie = showingMovies[4]
            })

            // 고객이 시청한 영화가 있을 때
            describe('when the customer has watched movies', () => {
                let accessToken: string

                beforeEach(async () => {
                    const watchedMovies = await createWatchedMovies(fix, [
                        { genres: [MovieGenre.Action] },
                        { genres: [MovieGenre.Action] },
                        { genres: [MovieGenre.Action] },
                        { genres: [MovieGenre.Comedy] },
                        { genres: [MovieGenre.Comedy] },
                        { genres: [MovieGenre.Drama] }
                    ])
                    accessToken = watchedMovies.accessToken
                })

                // 시청 기록을 기반으로 추천을 반환한다
                it('returns recommendations based on watch history', async () => {
                    await fix.httpClient
                        .get('/movies/recommended')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .ok([
                            actionMovie,
                            comedy2Movie, // 2900-03-01
                            comedy1Movie, // 2900-02-01
                            dramaMovie,
                            fantasyMovie
                        ])
                })
            })

            // 고객이 게스트일 때
            describe('when the customer is a guest', () => {
                // 기본 추천을 반환한다
                it('returns default recommendations', async () => {
                    await fix.httpClient.get('/movies/recommended').ok([
                        dramaMovie, // 2900-05-01
                        actionMovie, // 2900-04-01
                        comedy2Movie, // 2900-03-01
                        comedy1Movie, // 2900-02-01
                        fantasyMovie // 2900-01-01
                    ])
                })
            })
        })
    })
})
