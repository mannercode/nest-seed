import { Injectable } from '@nestjs/common'
import { maps, MethodLog, objectId } from 'common'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from './dtos'
import { ShowtimesRepository } from './showtimes.repository'

@Injectable()
export class ShowtimesService {
    constructor(private repository: ShowtimesRepository) {}

    @MethodLog()
    async createShowtimes(createDtos: ShowtimeCreateDto[]) {
        const showtimesToCreate = createDtos.map((dto) => ({
            ...dto,
            batchId: objectId(dto.batchId),
            theaterId: objectId(dto.theaterId),
            movieId: objectId(dto.movieId)
        }))

        await this.repository.createShowtimes(showtimesToCreate)

        return { success: true, count: showtimesToCreate.length }
    }

    @MethodLog({ level: 'verbose' })
    async getShowtime(showtimeId: string) {
        const showtime = await this.repository.getShowtime(objectId(showtimeId))
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
        return this.repository.findTheaterIdsShowingMovie(objectId(movieId))
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(movieId: string, theaterId: string) {
        return this.repository.findShowdates(objectId(movieId), objectId(theaterId))
    }
}
