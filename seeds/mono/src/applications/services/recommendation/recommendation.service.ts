import { DateUtil, OrderDirection, defaultTo } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { Rules } from 'config'
import { MovieDto, MoviesService, ShowtimesService, WatchRecordsService } from 'cores'
import { MovieRecommender } from './domain'

@Injectable()
export class RecommendationService {
    private readonly logger = new Logger(RecommendationService.name)

    constructor(
        private readonly showtimesService: ShowtimesService,
        private readonly moviesService: MoviesService,
        private readonly watchRecordsService: WatchRecordsService
    ) {}

    async searchRecommendedMovies(customerId: null | string) {
        const startTime = DateUtil.add({ minutes: Rules.Ticket.purchaseCutoffMinutes })

        const showingMovieIds = await this.showtimesService.searchMovieIds({
            startTimeRange: { start: startTime }
        })

        const showingMovies = await this.moviesService.getMany(showingMovieIds)
        let watchedMovies: MovieDto[] = []

        if (customerId) {
            const { items } = await this.watchRecordsService.searchPage({
                customerId,
                orderby: { direction: OrderDirection.Desc, name: 'watchDate' },
                size: 50
            })
            const movieIds = items.map((record) => record.movieId)
            watchedMovies = await this.moviesService.getMany(movieIds)
        }

        const recommendedMovies = MovieRecommender.recommend(showingMovies, watchedMovies)

        this.logger.log('searchRecommendedMovies', {
            customerId: defaultTo(customerId, 'anonymous'),
            showingMovieCount: showingMovies.length,
            recommendedCount: recommendedMovies.length
        })

        return recommendedMovies
    }
}
