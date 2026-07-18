import { OrderDirection, Require, sortBy, uniq } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { RecommendationService } from 'application'
import { MoviesService, ShowtimeDto, ShowtimesService, TheatersService } from 'core'
import { HomeMovieCard, HomeShowtimeView, UserHomeView } from './dtos'

const HOME_MOVIE_COUNT = 12
const SHOWTIMES_PER_MOVIE = 3

type TheaterRef = { id: string; name: string }

@Injectable()
export class UserHomeViewService {
    constructor(
        private readonly movies: MoviesService,
        private readonly showtimes: ShowtimesService,
        private readonly theaters: TheatersService,
        private readonly recommendation: RecommendationService
    ) {}

    async getHome(userId: null | string): Promise<UserHomeView> {
        const [cards, recommendedMovies] = await Promise.all([
            this.getUpcomingCards(),
            this.recommendation.searchRecommendedMovies(userId)
        ])

        return { showingMovies: cards, recommendedMovies }
    }

    private async getUpcomingCards(): Promise<HomeMovieCard[]> {
        // 최신 공개작 중 상영이 있는 영화만 카드가 된다.
        const page = await this.movies.searchPage({
            orderby: { direction: OrderDirection.Desc, name: 'releaseDate' },
            page: 1,
            size: HOME_MOVIE_COUNT
        })
        if (page.items.length === 0) return []

        const upcomingShowtimes = await this.showtimes.search({
            endTimeRange: { start: new Date() },
            movieIds: page.items.map((movie) => movie.id)
        })

        const theaterMap = await this.fetchTheaterMap(upcomingShowtimes)
        const showtimesByMovie = groupShowtimesByMovie(upcomingShowtimes, theaterMap)

        const cards: HomeMovieCard[] = []
        for (const movie of page.items) {
            const showtimes = showtimesByMovie.get(movie.id)
            if (!showtimes || showtimes.length === 0) continue
            cards.push({ movie, upcomingShowtimes: showtimes.slice(0, SHOWTIMES_PER_MOVIE) })
        }

        return cards
    }

    private async fetchTheaterMap(showtimes: ShowtimeDto[]): Promise<Map<string, TheaterRef>> {
        const theaterIds = uniq(showtimes.map((showtime) => showtime.theaterId))
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
): Map<string, HomeShowtimeView[]> {
    // 저장소의 반환 순서에 기대지 않고 카드마다 가까운 상영부터 정렬한다.
    const map = new Map<string, HomeShowtimeView[]>()

    for (const showtime of showtimes) {
        const theater = theaterMap.get(showtime.theaterId)
        Require.defined(theater, `theater missing for showtime ${showtime.id}`)

        const list = map.get(showtime.movieId) ?? []
        list.push({
            endTime: showtime.endTime,
            id: showtime.id,
            startTime: showtime.startTime,
            theater
        })
        map.set(showtime.movieId, list)
    }

    for (const [movieId, list] of map) {
        map.set(
            movieId,
            sortBy(list, (item) => item.startTime.getTime())
        )
    }

    return map
}
