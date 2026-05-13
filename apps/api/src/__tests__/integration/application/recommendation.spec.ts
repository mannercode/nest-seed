import { MovieGenre, type MovieDto } from 'core'
import type { AppTestContext } from '../helpers'
import { createShowingMovies, createWatchedMovies } from './recommendation.utils'

describe('RecommendationService', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
    })
    afterEach(() => fix.teardown())

    describe('GET /movies/recommended', () => {
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

        it('시청 기록이 있는 고객에게 시청 기록 기반 추천을 반환한다', async () => {
            const { accessToken } = await createWatchedMovies(fix, [
                { genres: [MovieGenre.Action] },
                { genres: [MovieGenre.Action] },
                { genres: [MovieGenre.Action] },
                { genres: [MovieGenre.Comedy] },
                { genres: [MovieGenre.Comedy] },
                { genres: [MovieGenre.Drama] }
            ])

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

        it('게스트에게는 개봉일 내림차순 기본 추천을 반환한다', async () => {
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
