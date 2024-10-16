import { Injectable } from '@nestjs/common'
import { maps, MethodLog, objectId, ObjectId } from 'common'
import { ShowtimeCreationDto, ShowtimeDto, ShowtimeFilterDto } from './dto'
import { ShowtimesRepository } from './showtimes.repository'

@Injectable()
export class ShowtimesService {
    constructor(private repository: ShowtimesRepository) {}

    @MethodLog()
    async createShowtimes(creationDtos: ShowtimeCreationDto[]) {
        const showtimesToCreate = creationDtos.map((dto) => ({
            ...dto,
            batchId: objectId(dto.batchId),
            theaterId: objectId(dto.theaterId),
            movieId: objectId(dto.movieId)
        }))

        await this.repository.createShowtimes(showtimesToCreate)

        return { success: true, count: showtimesToCreate.length }
    }

    @MethodLog({ level: 'verbose' })
    async getShowtime(showtimeId: ObjectId) {
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
    async findTheaterIdsShowingMovie(movieId: ObjectId) {
        return this.repository.findTheaterIdsShowingMovie(movieId)
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(movieId: ObjectId, theaterId: ObjectId) {
        return this.repository.findShowdates(movieId, theaterId)
    }
}
