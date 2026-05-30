import { ensure } from '@mannercode/common'
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

    // 추천은 GET /views/user-app/home 의 recommendedMovies 로 노출된다(별도 엔드포인트 없음).
    // 여기서는 추천 알고리즘(시청 기록·개봉일 정렬)을 home 응답을 통해 검증한다.
    describe('GET /views/user-app/home (recommendedMovies)', () => {
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

            fantasyMovie = ensure(showingMovies[0])
            comedy1Movie = ensure(showingMovies[1])
            comedy2Movie = ensure(showingMovies[2])
            actionMovie = ensure(showingMovies[3])
            dramaMovie = ensure(showingMovies[4])
        })

        describe('시청 기록이 있을 때', () => {
            let accessToken: string

            beforeEach(async () => {
                ;({ accessToken } = await createWatchedMovies(fix, [
                    { genres: [MovieGenre.Action] },
                    { genres: [MovieGenre.Action] },
                    { genres: [MovieGenre.Action] },
                    { genres: [MovieGenre.Comedy] },
                    { genres: [MovieGenre.Comedy] },
                    { genres: [MovieGenre.Drama] }
                ]))
            })

            it('시청 기록 기반 추천을 반환한다', async () => {
                const { body } = await fix.httpClient
                    .get('/views/user-app/home')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok()

                expect(body.recommendedMovies).toEqual([
                    actionMovie,
                    comedy2Movie, // 2900-03-01
                    comedy1Movie, // 2900-02-01
                    dramaMovie,
                    fantasyMovie
                ])
            })
        })

        describe('게스트일 때', () => {
            it('개봉일 내림차순 기본 추천을 반환한다', async () => {
                const { body } = await fix.httpClient.get('/views/user-app/home').ok()

                expect(body.recommendedMovies).toEqual([
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
