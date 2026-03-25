import { BaseService, DateUtil, OrderDirection } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { MovieDto, MoviesClient, ShowtimesClient, WatchRecordsClient } from 'apps/cores'
import { Rules } from 'common'
import { defaultTo } from 'lodash'
import { MovieRecommender } from './domain'

@Injectable()
export class RecommendationService extends BaseService {
    constructor(
        private readonly showtimesClient: ShowtimesClient,
        private readonly moviesClient: MoviesClient,
        private readonly watchRecordsClient: WatchRecordsClient
    ) {
        super()
    }

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

        this.log.info('searchRecommendedMovies', {
            customerId: defaultTo(customerId, 'anonymous'),
            showingMovieCount: showingMovies.length,
            recommendedCount: recommendedMovies.length
        })

        return recommendedMovies
    }
}
