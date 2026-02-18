import type { MovieDto } from 'apps/cores'
import { countBy, defaultTo, flatMap, orderBy, sumBy } from 'lodash'

export class MovieRecommender {
    static recommend(showingMovies: MovieDto[], watchedMovies: MovieDto[]) {
        // Collect IDs of watched movies to exclude them from recommendations.
        // 이미 본 영화 ID를 저장하여 추천 목록에서 제외
        const watchedMovieIds = new Set(watchedMovies.map((movie) => movie.id))

        // Calculate the frequency of each genre in the user's watch history.
        // 사용자가 관람한 영화의 장르 빈도를 계산
        const genreFrequency = countBy(flatMap(watchedMovies, (movie) => movie.genres))

        // Sort genres by their frequency in descending order.
        // 장르를 관람 빈도가 높은 순서로 정렬
        const favoriteGenres = orderBy(
            Object.keys(genreFrequency),
            (genre) => defaultTo(genreFrequency[genre], 0),
            'desc'
        )

        const genreScoreByGenre = new Map(
            favoriteGenres.map((genre, index) => [genre, favoriteGenres.length - index] as const)
        )

        // Assign a score to each currently showing movie (based on genre match + release date).
        // 상영 중인 영화에 점수를 매김 (장르 일치도 + 최신 개봉일)
        const scoredMovies = showingMovies
            // exclude movies already watched
            // 이미 본 영화는 제외
            .filter((movie) => !watchedMovieIds.has(movie.id))
            .map((movie) => ({
                genreScore: sumBy(movie.genres, (genre) => genreScoreByGenre.get(genre) ?? 0),
                movie,
                releaseDate: movie.releaseDate.getTime()
            }))

        // If the user has no watch history, sort by release date first.
        // 사용자의 관람 이력이 없으면 최신 개봉일 순으로 정렬
        const sortedMovies =
            watchedMovies.length === 0
                ? orderBy(scoredMovies, ['releaseDate'], ['desc'])
                : orderBy(scoredMovies, ['genreScore', 'releaseDate'], ['desc', 'desc'])

        return sortedMovies.map((item) => item.movie)
    }
}
