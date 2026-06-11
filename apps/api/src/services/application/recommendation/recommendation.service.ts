import { DateUtil, OrderDirection, defaultTo } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from 'config'
import { MovieDto, MoviesService, ShowtimesService, WatchRecordsService } from 'core'
import { MovieRecommender } from './domain'

// 추천에 반영할 최근 관람 기록 수.
// 페이지 상한(HTTP_PAGINATION_MAX_SIZE) 이내의 도메인 정책 값이다.
const RECENT_WATCH_LIMIT = 50

@Injectable()
export class RecommendationService {
    private readonly logger = new Logger(RecommendationService.name)

    constructor(
        private readonly showtimesService: ShowtimesService,
        private readonly moviesService: MoviesService,
        private readonly watchRecordsService: WatchRecordsService,
        private readonly config: AppConfigService
    ) {}

    async searchRecommendedMovies(userId: null | string) {
        const startTime = DateUtil.add({ minutes: this.config.ticket.purchaseCutoffMinutes })

        const showingMovieIds = await this.showtimesService.searchMovieIds({
            startTimeRange: { start: startTime }
        })

        const showingMovies = await this.moviesService.getMany(showingMovieIds)
        let watchedMovies: MovieDto[] = []

        if (userId) {
            const { items } = await this.watchRecordsService.searchPage({
                userId,
                orderby: { direction: OrderDirection.Desc, name: 'watchDate' },
                size: RECENT_WATCH_LIMIT
            })
            const movieIds = items.map((record) => record.movieId)
            watchedMovies = await this.moviesService.getMany(movieIds)
        }

        const recommendedMovies = MovieRecommender.recommend(showingMovies, watchedMovies)

        this.logger.log('searchRecommendedMovies', {
            userId: defaultTo(userId, 'anonymous'),
            showingMovieCount: showingMovies.length,
            recommendedCount: recommendedMovies.length
        })

        return recommendedMovies
    }
}
