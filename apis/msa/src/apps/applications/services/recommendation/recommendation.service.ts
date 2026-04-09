import { DateUtil, OrderDirection, defaultTo } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { Rules } from 'config'
import { MovieDto, MoviesClient, ShowtimesClient, WatchRecordsClient } from 'cores'
import { MovieRecommender } from './domain'

@Injectable()
export class RecommendationService {
    private readonly logger = new Logger(RecommendationService.name)

    constructor(
        private readonly showtimesClient: ShowtimesClient,
        private readonly moviesClient: MoviesClient,
        private readonly watchRecordsClient: WatchRecordsClient
    ) {}

    async searchRecommendedMovies(customerId: null | string) {
        const startTime = DateUtil.add({ minutes: Rules.Ticket.purchaseCutoffMinutes })

        const showingMovieIds = await this.showtimesClient.searchMovieIds({
            startTimeRange: { start: startTime }
        })

        const showingMovies = await this.moviesClient.getMany(showingMovieIds)
        let watchedMovies: MovieDto[] = []

        if (customerId) {
            const { items } = await this.watchRecordsClient.searchPage({
                customerId,
                orderby: { direction: OrderDirection.Desc, name: 'watchDate' },
                size: 50
            })
            const movieIds = items.map((record) => record.movieId)
            watchedMovies = await this.moviesClient.getMany(movieIds)
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
