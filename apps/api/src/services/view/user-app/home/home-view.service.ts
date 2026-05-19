import { Require } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { MoviesService, ShowtimeDto, ShowtimesService, TheatersService } from 'core'
import { HomeMovieCard, HomeShowtimeView, UserHomeView } from './dtos'

// 홈 한 화면에 가까운 상영이 보여야 하는 영화 수와 영화당 상영 수.
// 시드는 운영 정책 값을 코드 상수로 두는 패턴을 따른다.
const HOME_MOVIE_COUNT = 12
const SHOWTIMES_PER_MOVIE = 3

type TheaterRef = { id: string; name: string }

@Injectable()
export class UserHomeViewService {
    constructor(
        private readonly movies: MoviesService,
        private readonly showtimes: ShowtimesService,
        private readonly theaters: TheatersService
    ) {}

    async getHome(): Promise<UserHomeView> {
        // 공개된 영화만 후보. searchPage가 isPublished=true 필터를 강제한다.
        const page = await this.movies.searchPage({ page: 1, size: HOME_MOVIE_COUNT })
        if (page.items.length === 0) return { movies: [] }

        const upcomingShowtimes = await this.showtimes.search({
            endTimeRange: { start: new Date() },
            movieIds: page.items.map((movie) => movie.id)
        })

        const theaterMap = await this.fetchTheaterMap(upcomingShowtimes)
        const showtimesByMovie = groupShowtimesByMovie(upcomingShowtimes, theaterMap)

        const cards: HomeMovieCard[] = []
        for (const movie of page.items) {
            const showtimes = showtimesByMovie.get(movie.id)
            // 사용자 홈은 "지금 볼 수 있는" 영화 큐레이션이라 상영이 없는 영화는 카드에서 뺀다.
            if (!showtimes || showtimes.length === 0) continue
            cards.push({ movie, upcomingShowtimes: showtimes.slice(0, SHOWTIMES_PER_MOVIE) })
        }

        return { movies: cards }
    }

    private async fetchTheaterMap(showtimes: ShowtimeDto[]): Promise<Map<string, TheaterRef>> {
        const theaterIds = [...new Set(showtimes.map((showtime) => showtime.theaterId))]
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
    // showtimes는 호출 측에서 시작 시각 순서를 보장하지 않으므로 그룹화 후 정렬한다.
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

    for (const list of map.values()) {
        list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    }

    return map
}
