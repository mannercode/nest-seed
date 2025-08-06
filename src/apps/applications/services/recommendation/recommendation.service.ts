import { Injectable } from '@nestjs/common'
import { DateUtil, OrderDirection } from 'common'
import { MovieDto, MoviesClient, ShowtimesClient, WatchRecordsClient } from 'apps/cores'
import { MovieRecommender } from './domain'
import { Rules } from 'shared'

@Injectable()
export class RecommendationService {
    constructor(
        private showtimesService: ShowtimesClient,
        private moviesService: MoviesClient,
        private watchRecordsService: WatchRecordsClient
    ) {}

    async searchRecommendedMovies(customerId: string | null) {
        const startTime = DateUtil.add({ minutes: Rules.Ticket.purchaseWindowCloseOffsetMinutes })

        const showingMovieIds = await this.showtimesService.searchMovieIds({
            startTimeRange: { start: startTime }
        })

        const showingMovies = await this.moviesService.getMovies(showingMovieIds)
        let watchedMovies: MovieDto[] = []

        if (customerId) {
            const { items } = await this.watchRecordsService.searchWatchRecordsPage({
                customerId,
                take: 50,
                orderby: { name: 'watchDate', direction: OrderDirection.Desc }
            })
            const movieIds = items.map((record) => record.movieId)
            watchedMovies = await this.moviesService.getMovies(movieIds)
        }

        const recommendedMovies = MovieRecommender.recommend(showingMovies, watchedMovies)
        return recommendedMovies
    }
}
