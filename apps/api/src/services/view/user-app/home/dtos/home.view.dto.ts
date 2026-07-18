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
    recommendedMovies: MovieDto[]
}
