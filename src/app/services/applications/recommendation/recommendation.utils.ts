import { MovieDto } from 'services/cores'

export function generateRecommendedMovies(showingMovies: MovieDto[], watchedMovies: MovieDto[]) {
    // 이미 본 영화 ID를 저장하여 추천 목록에서 제외
    const watchedMovieIds = new Set(watchedMovies.map((movie) => movie.id))

    // 사용자가 관람한 영화의 장르 빈도를 계산
    const genreFrequency: { [genre: string]: number } = {}
    for (const movie of watchedMovies) {
        for (const genre of movie.genre) {
            genreFrequency[genre] = (genreFrequency[genre] || 0) + 1
        }
    }

    // 장르를 관람 빈도가 높은 순서로 정렬
    const favoriteGenres = Object.keys(genreFrequency).sort(
        (a, b) => genreFrequency[b] - genreFrequency[a]
    )

    // 상영 중인 영화에 점수를 매김 (장르 일치도 + 최신 개봉일)
    const scoredMovies = showingMovies
        .filter((movie) => !watchedMovieIds.has(movie.id)) // 이미 본 영화는 제외
        .map((movie) => {
            let genreScore = 0
            for (const genre of movie.genre) {
                const index = favoriteGenres.indexOf(genre)
                if (index !== -1) {
                    // 관람 빈도가 높은 장르일수록 높은 점수 부여
                    genreScore += favoriteGenres.length - index
                }
            }
            return {
                movie,
                genreScore,
                releaseDate: movie.releaseDate.getTime()
            }
        })

    // 사용자의 관람 이력이 없으면 개봉일 최신 순으로 정렬
    if (watchedMovies.length === 0) {
        scoredMovies.sort((a, b) => b.releaseDate - a.releaseDate)
    } else {
        // 관람 이력이 있으면 장르 점수 우선 정렬, 동점이면 개봉일 순으로 정렬
        scoredMovies.sort((a, b) => {
            if (b.genreScore !== a.genreScore) {
                return b.genreScore - a.genreScore
            } else {
                return b.releaseDate - a.releaseDate
            }
        })
    }

    // 정렬된 영화 목록 반환
    return scoredMovies.map((item) => item.movie)
}
