import { plainDate } from '@mannercode/testing'
import { MovieGenre, MovieRating, type MovieDto } from '#core'
import { MovieRecommender } from '../index.js'

describe('MovieRecommender', () => {
    describe('recommend', () => {
        const createDto = (
            id: string,
            genres: MovieGenre[],
            releaseDate: Temporal.PlainDate
        ): MovieDto => ({
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

        let showingMovies: MovieDto[]

        beforeEach(() => {
            showingMovies = [
                createDto('1', [MovieGenre.Action], plainDate('2023-09-01')),
                createDto('2', [MovieGenre.Drama], plainDate('2023-10-01')),
                createDto('3', [MovieGenre.Comedy], plainDate('2023-08-01'))
            ]
        })

        it.each([
            {
                expectedIds: ['2', '1', '3'],
                name: '시청 기록이 없으면 개봉일이 최신인 순서로 추천한다',
                watchedMovies: []
            },
            {
                expectedIds: ['1', '2', '3'],
                name: '액션 장르를 가장 많이 시청했으면 액션 영화를 먼저 추천한다',
                watchedMovies: [
                    createDto('4', [MovieGenre.Action], plainDate('2023-07-01')),
                    createDto('5', [MovieGenre.Action], plainDate('2023-06-01')),
                    createDto('6', [MovieGenre.Drama], plainDate('2023-05-01'))
                ]
            },
            {
                expectedIds: ['1', '3'],
                name: '이미 시청한 영화는 추천 결과에서 제외한다',
                watchedMovies: [createDto('2', [MovieGenre.Drama], plainDate('2023-10-01'))]
            }
        ])('$name', ({ watchedMovies, expectedIds }) => {
            const recommendedMovies = MovieRecommender.recommend(showingMovies, watchedMovies)

            expect(recommendedMovies.map((movie) => movie.id)).toEqual(expectedIds)
        })
    })
})
