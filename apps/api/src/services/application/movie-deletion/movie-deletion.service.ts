import { ConflictException, Injectable } from '@nestjs/common'
import { MovieErrors, MoviesService, ShowtimesService } from '#core'

@Injectable()
export class MovieDeletionService {
    constructor(
        private readonly moviesService: MoviesService,
        private readonly showtimesService: ShowtimesService
    ) {}

    async deleteMovie(movieId: string) {
        if (await this.showtimesService.existsByMovieIds([movieId])) {
            throw new ConflictException(MovieErrors.DeleteBlockedByShowtimes(movieId))
        }
        await this.moviesService.deleteMany([movieId])
    }
}
