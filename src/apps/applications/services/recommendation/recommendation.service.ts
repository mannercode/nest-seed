import { Injectable } from '@nestjs/common'
import { OrderDirection } from 'common'
import { MovieDto, MoviesProxy, ShowtimesProxy, WatchRecordsProxy } from 'cores'
import { generateRecommendedMovies } from './recommendation.utils'

@Injectable()
export class RecommendationService {
    constructor(
        private showtimesService: ShowtimesProxy,
        private moviesService: MoviesProxy,
        private watchRecordsService: WatchRecordsProxy
    ) {}

    async findRecommendedMovies(customerId: string | null) {
        const showingMovieIds = await this.showtimesService.findShowingMovieIds()

        const showingMovies = await this.moviesService.getMoviesByIds(showingMovieIds)
        let watchedMovies: MovieDto[] = []

        if (customerId) {
            const { items } = await this.watchRecordsService.findWatchRecords({
                customerId,
                take: 50,
                orderby: { name: 'watchDate', direction: OrderDirection.desc }
            })
            const movieIds = items.map((record) => record.movieId)
            watchedMovies = await this.moviesService.getMoviesByIds(movieIds)
        }

        const recommendedMovies = generateRecommendedMovies(showingMovies, watchedMovies)
        return recommendedMovies
    }
}
