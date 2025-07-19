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
            await createWatchedMovies(fix, [
                { title: 'Action1', genres: [MovieGenre.Action] },
                { title: 'Action2', genres: [MovieGenre.Action] },
                { title: 'Action3', genres: [MovieGenre.Action] },
                { title: 'Comedy1', genres: [MovieGenre.Comedy] },
                { title: 'Comedy2', genres: [MovieGenre.Comedy] },
                { title: 'Drama1', genres: [MovieGenre.Drama] }
            ])

            showingMovies = await createShowingMovies(fix, [
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
                {
                    title: 'Drama',
                    genres: [MovieGenre.Drama],
                    releaseDate: new Date('2900-05-01')
                }
            ])
        })

        // 상황: 로그인한 사용자일 때
        describe('when the user is logged in', () => {
            // 기대 결과: 가장 많이 본 장르, 최신 개봉일 순으로 정렬된 영화 목록을 반환한다.
            it('returns a list of movies sorted by most-watched genres, then by latest release date', async () => {
                const { body } = await fix.httpClient
                    .get('/movies/recommended')
                    .headers({ Authorization: `Bearer ${fix.accessToken}` })
                    .ok()

                expect(body).toEqual([
                    showingMovies[3], // Action
                    showingMovies[2], // Comedy2, 2900-03-01
                    showingMovies[1], // Comedy1, 2900-02-01
                    showingMovies[4], // Drama
                    showingMovies[0] // Fantasy
                ])
            })
        })

        // 상황: 로그인하지 않은 사용자일 때
        describe('when the user is not logged in', () => {
            // 기대 결과: 최신 개봉일 순으로 정렬된 영화 목록을 반환한다.
            it('returns a list of movies sorted by the latest release date', async () => {
                const { body } = await fix.httpClient.get('/movies/recommended').ok()

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
})
