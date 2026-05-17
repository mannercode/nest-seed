import type { PaginationResult } from '@mannercode/common'
import type { MovieDto } from 'core'

export class ConsoleShowtimeView {
    endTime: Date
    id: string
    movieId: string
    startTime: Date
    theater: { id: string; name: string }
}

export class ConsoleMovieListItemView {
    movie: MovieDto
    showtimes: ConsoleShowtimeView[]
}

export type ConsoleMoviesView = PaginationResult<ConsoleMovieListItemView>
