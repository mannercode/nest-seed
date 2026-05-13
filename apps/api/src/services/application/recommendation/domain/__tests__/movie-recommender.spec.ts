import { MovieGenre, MovieRating, type MovieDto } from 'core'
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

        it('시청 기록이 없으면 개봉일 기준으로 정렬된 영화를 반환한다', () => {
            const showingMovies = [
                createDto('1', [MovieGenre.Action], new Date('2023-09-01')),
                createDto('2', [MovieGenre.Drama], new Date('2023-10-01')),
                createDto('3', [MovieGenre.Comedy], new Date('2023-08-01'))
            ]

            const recommendedMovies = MovieRecommender.recommend(showingMovies, [])

            expect(recommendedMovies.map((movie) => movie.id)).toEqual(['2', '1', '3'])
        })

        it('시청 기록이 있으면 선호 장르 기준으로 정렬된 영화를 반환한다', () => {
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

        it('이미 시청한 영화는 추천 결과에서 제외한다', () => {
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
