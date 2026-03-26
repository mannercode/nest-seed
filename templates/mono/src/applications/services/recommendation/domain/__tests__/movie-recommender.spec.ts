import type { MovieDto } from 'cores'
import { MovieGenre, MovieRating } from 'cores'
import { MovieRecommender } from '..'

describe('MovieRecommender', () => {
    describe('recommend', () => {
        const createDto = (id: string, genres: MovieGenre[], releaseDate: Date): MovieDto => ({
            director: '.',
            durationInSeconds: 0,
            genres,
            id,
            imageUrls: [],
            plot: '.',
            rating: MovieRating.PG,
            releaseDate,
            title: `MovieTitle#${id}`
        })

        // 시청 기록이 없을 때
        describe('when the watch history does not exist', () => {
            // releaseDate 기준으로 정렬된 영화를 반환한다
            it('returns movies sorted by releaseDate', () => {
                const showingMovies = [
                    createDto('1', [MovieGenre.Action], new Date('2023-09-01')),
                    createDto('2', [MovieGenre.Drama], new Date('2023-10-01')),
                    createDto('3', [MovieGenre.Comedy], new Date('2023-08-01'))
                ]

                const recommendedMovies = MovieRecommender.recommend(showingMovies, [])

                expect(recommendedMovies.map((movie) => movie.id)).toEqual(['2', '1', '3'])
            })
        })

        // 시청 기록이 있을 때
        describe('when the watch history exists', () => {
            // 선호 장르 기준으로 정렬된 영화를 반환한다
            it('returns movies sorted by preferred genres', () => {
                const showingMovies = [
                    createDto('1', [MovieGenre.Action], new Date('2023-09-01')),
                    createDto('2', [MovieGenre.Drama], new Date('2023-10-01')),
                    createDto('3', [MovieGenre.Comedy], new Date('2023-08-01'))
                ]

                const watchedMovies = [
                    createDto('4', [MovieGenre.Action], new Date('2023-07-01')),
                    createDto('5', [MovieGenre.Action], new Date('2023-06-01')),
                    createDto('6', [MovieGenre.Drama], new Date('2023-05-01'))
                ]

                const recommendedMovies = MovieRecommender.recommend(showingMovies, watchedMovies)

                expect(recommendedMovies.map((movie) => movie.id)).toEqual(['1', '2', '3'])
            })

            // 이미 시청한 영화를 제외한 영화를 반환한다
            it('returns movies excluding already-watched ones', () => {
                const showingMovies = [
                    createDto('1', [MovieGenre.Action], new Date('2023-09-01')),
                    createDto('2', [MovieGenre.Drama], new Date('2023-10-01')),
                    createDto('3', [MovieGenre.Comedy], new Date('2023-08-01'))
                ]

                const watchedMovies = [createDto('2', [MovieGenre.Drama], new Date('2023-10-01'))]

                const recommendedMovies = MovieRecommender.recommend(showingMovies, watchedMovies)

                expect(recommendedMovies.map((movie) => movie.id)).toEqual(['1', '3'])
            })
        })
    })
})
