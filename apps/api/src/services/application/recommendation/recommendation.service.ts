import { DateUtil, OrderDirection, defaultTo } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from 'config'
import { MovieDto, MoviesService, ShowtimesService, WatchRecordsService } from 'core'
import { MovieRecommender } from './domain'

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
                size: 50
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
