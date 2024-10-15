import { Injectable } from '@nestjs/common'
import { maps, MethodLog } from 'common'
import { ShowtimeCreationDto, ShowtimeDto, ShowtimeFilterDto } from './dto'
import { ShowtimesRepository } from './showtimes.repository'

@Injectable()
export class ShowtimesService {
    constructor(private repository: ShowtimesRepository) {}

    @MethodLog()
    async createShowtimes(creationDtos: ShowtimeCreationDto[]) {
        await this.repository.createShowtimes(creationDtos)

        return { success: true, count: creationDtos.length }
    }

    @MethodLog({ level: 'verbose' })
    async getShowtime(showtimeId: string) {
        const showtime = await this.repository.getShowtime(showtimeId)
        return new ShowtimeDto(showtime)
    }

    @MethodLog({ level: 'verbose' })
    async findAllShowtimes(filterDto: ShowtimeFilterDto) {
        const showtimes = await this.repository.findAllShowtimes(filterDto)

        return maps(showtimes, ShowtimeDto)
    }

    @MethodLog({ level: 'verbose' })
    async findShowingMovieIds(): Promise<string[]> {
        const currentTime = new Date()
        return this.repository.findMovieIdsShowingAfter(currentTime)
    }

    @MethodLog({ level: 'verbose' })
    async findTheaterIdsShowingMovie(movieId: string) {
        return this.repository.findTheaterIdsShowingMovie(movieId)
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(movieId: string, theaterId: string) {
        return this.repository.findShowdates(movieId, theaterId)
    }
}
