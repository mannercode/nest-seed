import type { MovieDto } from '#core'

export class HomeShowtimeView {
    endTime: Temporal.Instant
    id: string
    startTime: Temporal.Instant
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
