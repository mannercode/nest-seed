import { ConflictException, Injectable } from '@nestjs/common'
import { MovieErrors, MoviesService, ShowtimesService, TheaterErrors, TheatersService } from '#core'

@Injectable()
export class CatalogManagementService {
    constructor(
        private readonly moviesService: MoviesService,
        private readonly showtimesService: ShowtimesService,
        private readonly theatersService: TheatersService
    ) {}

    async deleteMovie(movieId: string) {
        if (await this.showtimesService.existsByMovieIds([movieId])) {
            throw new ConflictException(MovieErrors.DeleteBlockedByShowtimes(movieId))
        }
        await this.moviesService.deleteMany([movieId])
    }

    async deleteTheater(theaterId: string) {
        if (await this.showtimesService.existsByTheaterIds([theaterId])) {
            throw new ConflictException(TheaterErrors.DeleteBlockedByShowtimes(theaterId))
        }
        await this.theatersService.deleteMany([theaterId])
    }
}
