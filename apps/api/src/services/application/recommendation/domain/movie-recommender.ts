import type { MovieDto } from 'core'
import { countBy, defaultTo, orderBy, sumBy } from '@mannercode/common'

export class MovieRecommender {
    static recommend(showingMovies: MovieDto[], watchedMovies: MovieDto[]) {
        const watchedMovieIds = new Set(watchedMovies.map((movie) => movie.id))

        const genreFrequency = countBy(watchedMovies.flatMap((movie) => movie.genres))

        const favoriteGenres = orderBy(
            Object.keys(genreFrequency),
            (genre) => defaultTo(genreFrequency[genre], 0),
            'desc'
        )

        const genreScoreByGenre = new Map(
            favoriteGenres.map((genre, index) => [genre, favoriteGenres.length - index] as const)
        )

        const scoredMovies = showingMovies
            .filter((movie) => !watchedMovieIds.has(movie.id))
            .map((movie) => ({
                genreScore: sumBy(movie.genres, (genre) => genreScoreByGenre.get(genre) ?? 0),
                movie,
                releaseDate: movie.releaseDate.getTime()
            }))

        // 관람 이력이 없으면 장르 점수가 모두 0이라서 정렬에 쓸 만한 신호가
        // 없습니다. 그래서 이력이 없을 때는 최신 개봉일 순으로만 정렬합니다.
        const sortedMovies =
            watchedMovies.length === 0
                ? orderBy(scoredMovies, ['releaseDate'], ['desc'])
                : orderBy(scoredMovies, ['genreScore', 'releaseDate'], ['desc', 'desc'])

        return sortedMovies.map((item) => item.movie)
    }
}
