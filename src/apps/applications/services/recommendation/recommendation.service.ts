import { Injectable } from '@nestjs/common'
import { MovieDto, MoviesClient, ShowtimesClient, WatchRecordsClient } from 'apps/cores'
import { DateUtil, OrderDirection } from 'common'
import { Rules } from 'shared'
import { MovieRecommender } from './domain'

@Injectable()
export class RecommendationService {
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
                take: 50
            })
            const movieIds = items.map((record) => record.movieId)
            watchedMovies = await this.moviesClient.getMany(movieIds)
        }

        const recommendedMovies = MovieRecommender.recommend(showingMovies, watchedMovies)
        return recommendedMovies
    }
}
