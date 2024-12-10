import { Injectable } from '@nestjs/common'
import { MethodLog, OrderDirection } from 'common'
import { MovieDto, MoviesService, ShowtimesService, WatchRecordsService } from 'services/cores'
import { generateRecommendedMovies } from './recommendation.utils'

@Injectable()
export class RecommendationService {
    constructor(
        private showtimesService: ShowtimesService,
        private moviesService: MoviesService,
        private watchRecordsService: WatchRecordsService
    ) {}

    @MethodLog({ level: 'verbose' })
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
