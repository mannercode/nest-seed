import { countBy, defaultTo, orderBy, sumBy } from '@mannercode/common'
import type { MovieDto } from '#core'

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
                releaseDate: movie.releaseDate.toString()
            }))

        // 관람 이력이 없으면 장르 점수가 모두 0이므로 개봉일만 순서를 결정한다.
        const sortedMovies = orderBy(scoredMovies, ['genreScore', 'releaseDate'], ['desc', 'desc'])

        return sortedMovies.map((item) => item.movie)
    }
}
