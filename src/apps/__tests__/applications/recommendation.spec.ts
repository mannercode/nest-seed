import { MovieDto, MovieGenre } from 'apps/cores'
import {
    createShowingMovies,
    createWatchedMovies,
    type RecommendationFixture
} from './recommendation.fixture'

describe('RecommendationService', () => {
    let fix: RecommendationFixture

    beforeEach(async () => {
        const { createRecommendationFixture } = await import('./recommendation.fixture')
        fix = await createRecommendationFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('GET /movies/recommended', () => {
        describe('when showing movies exist', () => {
            let fantasyMovie: MovieDto
            let comedy1Movie: MovieDto
            let comedy2Movie: MovieDto
            let actionMovie: MovieDto
            let dramaMovie: MovieDto

            beforeEach(async () => {
                ;[fantasyMovie, comedy1Movie, comedy2Movie, actionMovie, dramaMovie] =
                    await createShowingMovies(fix, [
                        { genres: [MovieGenre.Fantasy], releaseDate: new Date('2900-01-01') },
                        { genres: [MovieGenre.Comedy], releaseDate: new Date('2900-02-01') },
                        { genres: [MovieGenre.Comedy], releaseDate: new Date('2900-03-01') },
                        { genres: [MovieGenre.Action], releaseDate: new Date('2900-04-01') },
                        { genres: [MovieGenre.Drama], releaseDate: new Date('2900-05-01') }
                    ])
            })

            describe('when the customer has watched movies', () => {
                let accessToken: string

                beforeEach(async () => {
                    const result = await createWatchedMovies(fix, [
                        { genres: [MovieGenre.Action] },
                        { genres: [MovieGenre.Action] },
                        { genres: [MovieGenre.Action] },
                        { genres: [MovieGenre.Comedy] },
                        { genres: [MovieGenre.Comedy] },
                        { genres: [MovieGenre.Drama] }
                    ])

                    accessToken = result.accessToken
                })

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

            it('returns default recommendations for a guest', async () => {
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
