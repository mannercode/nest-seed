import type { MovieDto } from 'cores'
import { countBy, defaultTo, orderBy, sumBy } from '@mannercode/common'

export class MovieRecommender {
    static recommend(showingMovies: MovieDto[], watchedMovies: MovieDto[]) {
        // 이미 본 영화 ID를 저장하여 추천 목록에서 제외
        const watchedMovieIds = new Set(watchedMovies.map((movie) => movie.id))

        // 사용자가 관람한 영화의 장르 빈도를 계산
        const genreFrequency = countBy(watchedMovies.flatMap((movie) => movie.genres))

        // 장르를 관람 빈도가 높은 순서로 정렬
        const favoriteGenres = orderBy(
            Object.keys(genreFrequency),
            (genre) => defaultTo(genreFrequency[genre], 0),
            'desc'
        )

        const genreScoreByGenre = new Map(
            favoriteGenres.map((genre, index) => [genre, favoriteGenres.length - index] as const)
        )

        // 상영 중인 영화에 점수를 매김 (장르 일치도 + 최신 개봉일)
        const scoredMovies = showingMovies
            // 이미 본 영화는 제외
            .filter((movie) => !watchedMovieIds.has(movie.id))
            .map((movie) => ({
                genreScore: sumBy(movie.genres, (genre) => genreScoreByGenre.get(genre) ?? 0),
                movie,
                releaseDate: movie.releaseDate.getTime()
            }))

        // 사용자의 관람 이력이 없으면 최신 개봉일 순으로 정렬
        const sortedMovies =
            watchedMovies.length === 0
                ? orderBy(scoredMovies, ['releaseDate'], ['desc'])
                : orderBy(scoredMovies, ['genreScore', 'releaseDate'], ['desc', 'desc'])

        return sortedMovies.map((item) => item.movie)
    }
}
