import { MovieDto } from 'apps/cores'

export class MovieRecommender {
    static recommend(showingMovies: MovieDto[], watchedMovies: MovieDto[]) {
        // Collect IDs of watched movies to exclude them from recommendations.
        // 이미 본 영화 ID를 저장하여 추천 목록에서 제외
        const watchedMovieIds = new Set(watchedMovies.map((movie) => movie.id))

        // Calculate the frequency of each genre in the user's watch history.
        // 사용자가 관람한 영화의 장르 빈도를 계산
        const genreFrequency: { [genres: string]: number } = {}
        for (const movie of watchedMovies) {
            for (const genre of movie.genres) {
                genreFrequency[genre] = (genreFrequency[genre] || 0) + 1
            }
        }

        // Sort genres by their frequency in descending order.
        // 장르를 관람 빈도가 높은 순서로 정렬
        const favoriteGenres = Object.keys(genreFrequency).sort(
            (a, b) => genreFrequency[b] - genreFrequency[a]
        )

        // Assign a score to each currently showing movie (based on genre match + release date).
        // 상영 중인 영화에 점수를 매김 (장르 일치도 + 최신 개봉일)
        const scoredMovies = showingMovies

            // exclude movies already watched
            // 이미 본 영화는 제외
            .filter((movie) => !watchedMovieIds.has(movie.id))
            .map((movie) => {
                let genreScore = 0
                for (const genre of movie.genres) {
                    const index = favoriteGenres.indexOf(genre)
                    if (index !== -1) {
                        // Assign higher scores for more frequently watched genres
                        // 관람 빈도가 높은 장르일수록 높은 점수 부여
                        genreScore += favoriteGenres.length - index
                    }
                }
                return { movie, genreScore, releaseDate: movie.releaseDate.getTime() }
            })

        // If the user has no watch history, sort by most recent release date first.
        // 사용자의 관람 이력이 없으면 개봉일 최신 순으로 정렬
        if (watchedMovies.length === 0) {
            scoredMovies.sort((a, b) => b.releaseDate - a.releaseDate)
        } else {
            // If there's watch history, sort primarily by genre score, then by release date if tied.
            // 관람 이력이 있으면 장르 점수 우선 정렬, 동점이면 개봉일 순으로 정렬
            scoredMovies.sort((a, b) => {
                if (b.genreScore !== a.genreScore) {
                    return b.genreScore - a.genreScore
                } else {
                    return b.releaseDate - a.releaseDate
                }
            })
        }

        return scoredMovies.map((item) => item.movie)
    }
}
