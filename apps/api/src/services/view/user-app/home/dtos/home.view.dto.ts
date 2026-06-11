import type { MovieDto } from 'core'

export class HomeShowtimeView {
    endTime: Date
    id: string
    startTime: Date
    theater: { id: string; name: string }
}

export class HomeMovieCard {
    movie: MovieDto
    upcomingShowtimes: HomeShowtimeView[]
}

export class UserHomeView {
    showingMovies: HomeMovieCard[]
    // 로그인하면 시청 기록 기반으로 개인화하고, 게스트는 개봉일 순으로 채운다.
    recommendedMovies: MovieDto[]
}
