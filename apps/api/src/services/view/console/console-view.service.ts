import { OrderDirection, type PaginationResult, Require } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import {
    MoviesService,
    type SearchMoviesPageDto,
    type ShowtimeDto,
    ShowtimesService,
    TheatersService
} from 'core'
import type { ConsoleMovieListItemView, ConsoleMoviesView, ConsoleShowtimeView } from './dtos'

type TheaterRef = { id: string; name: string }

@Injectable()
export class ConsoleViewService {
    constructor(
        private readonly movies: MoviesService,
        private readonly showtimes: ShowtimesService,
        private readonly theaters: TheatersService
    ) {}

    async getMovies(searchDto: SearchMoviesPageDto): Promise<ConsoleMoviesView> {
        const page = await this.movies.searchPage({
            ...searchDto,
            orderby: searchDto.orderby ?? { direction: OrderDirection.Desc, name: 'createdAt' }
        })
        if (page.items.length === 0) return { ...page, items: [] }

        const upcomingShowtimes = await this.showtimes.search({
            endTimeRange: { start: new Date() },
            movieIds: page.items.map((movie) => movie.id)
        })
        const theaterMap = await this.fetchTheaterMap(upcomingShowtimes)
        const showtimesByMovie = groupShowtimesByMovie(upcomingShowtimes, theaterMap)

        return {
            ...page,
            items: page.items.map((movie) => ({
                movie,
                showtimes: showtimesByMovie.get(movie.id) ?? []
            }))
        } satisfies PaginationResult<ConsoleMovieListItemView>
    }

    private async fetchTheaterMap(showtimes: ShowtimeDto[]): Promise<Map<string, TheaterRef>> {
        const theaterIds = unique(showtimes.map((showtime) => showtime.theaterId))
        if (theaterIds.length === 0) return new Map()

        const theaters = await this.theaters.getMany(theaterIds)
        return new Map(
            theaters.map((theater) => [theater.id, { id: theater.id, name: theater.name }])
        )
    }
}

function groupShowtimesByMovie(
    showtimes: ShowtimeDto[],
    theaterMap: Map<string, TheaterRef>
): Map<string, ConsoleShowtimeView[]> {
    const map = new Map<string, ConsoleShowtimeView[]>()

    for (const showtime of showtimes) {
        const item = toConsoleShowtimeView(showtime, theaterMap)
        const current = map.get(showtime.movieId) ?? []
        current.push(item)
        map.set(showtime.movieId, current)
    }

    return map
}

function toConsoleShowtimeView(
    showtime: ShowtimeDto,
    theaterMap: Map<string, TheaterRef>
): ConsoleShowtimeView {
    const theater = theaterMap.get(showtime.theaterId)
    Require.defined(theater, `theater missing for showtime ${showtime.id}`)

    return {
        endTime: showtime.endTime,
        id: showtime.id,
        movieId: showtime.movieId,
        startTime: showtime.startTime,
        theater
    }
}

function unique<T>(values: T[]): T[] {
    return [...new Set(values)]
}
