import { Injectable } from '@nestjs/common'
import { MethodLog, objectId, toDto, toDtos } from 'common'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from './dtos'
import { ShowtimesRepository } from './showtimes.repository'

@Injectable()
export class ShowtimesService {
    constructor(private repository: ShowtimesRepository) {}

    @MethodLog()
    async createShowtimes(createDtos: ShowtimeCreateDto[]) {
        const payloads = createDtos.map((dto) => ({
            ...dto,
            batchId: objectId(dto.batchId),
            theaterId: objectId(dto.theaterId),
            movieId: objectId(dto.movieId)
        }))

        await this.repository.createShowtimes(payloads)

        return { success: true, count: payloads.length }
    }

    @MethodLog({ level: 'verbose' })
    async getShowtime(showtimeId: string) {
        const showtime = await this.repository.getById(objectId(showtimeId))

        return toDto(showtime, ShowtimeDto)
    }

    @MethodLog({ level: 'verbose' })
    async findAllShowtimes(filterDto: ShowtimeFilterDto) {
        const showtimes = await this.repository.findAllShowtimes(filterDto)

        return toDtos(showtimes, ShowtimeDto)
    }

    @MethodLog({ level: 'verbose' })
    async findShowingMovieIds(): Promise<string[]> {
        const currentTime = new Date()

        return this.repository.findMovieIdsShowingAfter(currentTime)
    }

    @MethodLog({ level: 'verbose' })
    async findTheaterIdsByMovieId(movieId: string) {
        return this.repository.findTheaterIdsByMovieId(objectId(movieId))
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(args: { movieId: string; theaterId: string }) {
        const { movieId, theaterId } = args

        return this.repository.findShowdates({
            movieId: objectId(movieId),
            theaterId: objectId(theaterId)
        })
    }
}
