import { MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { MovieRecommender } from '..'

describe('MovieRecommender', () => {
    describe('recommend', () => {
        const createDto = (id: string, genres: MovieGenre[], releaseDate: Date): MovieDto => ({
            id,
            title: `MovieTitle#${id}`,
            genres,
            releaseDate,
            plot: '.',
            durationInSeconds: 0,
            director: '.',
            rating: MovieRating.PG,
            imageUrls: []
        })

        // 사용자의 관람 이력이 존재하지 않는 경우
        describe('when the watch history does not exist', () => {
            // 개봉일 순으로 정렬된 영화 목록을 반환한다
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

        // 사용자의 관람 이력이 존재하는 경우
        describe('when the watch history exists', () => {
            // 선호 장르 순으로 정렬된 영화 목록을 반환한다
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

            // 이미 본 영화는 목록에서 제외하고 반환한다
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
