import { Injectable } from '@nestjs/common'
import { mapDocToDto, MethodLog } from 'common'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from './dtos'
import { ShowtimeDocument } from './models'
import { ShowtimesRepository } from './showtimes.repository'

@Injectable()
export class ShowtimesService {
    constructor(private repository: ShowtimesRepository) {}

    @MethodLog()
    async createShowtimes(createDtos: ShowtimeCreateDto[]) {
        await this.repository.createShowtimes(createDtos)

        return { success: true, count: createDtos.length }
    }

    @MethodLog({ level: 'verbose' })
    async getShowtimes(showtimeIds: string[]) {
        const showtimes = await this.repository.getByIds(showtimeIds)

        return this.toDtos(showtimes)
    }

    @MethodLog({ level: 'verbose' })
    async findAllShowtimes(filterDto: ShowtimeFilterDto) {
        const showtimes = await this.repository.findAllShowtimes(filterDto)

        return this.toDtos(showtimes)
    }

    @MethodLog({ level: 'verbose' })
    async findShowingMovieIds() {
        const currentTime = new Date()

        return this.repository.findMovieIdsShowingAfter(currentTime)
    }

    @MethodLog({ level: 'verbose' })
    async findTheaterIdsByMovieId(movieId: string) {
        return this.repository.findTheaterIdsByMovieId(movieId)
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(args: { movieId: string; theaterId: string }) {
        return this.repository.findShowdates(args)
    }

    private toDto = (showtime: ShowtimeDocument) =>
        mapDocToDto(showtime, ShowtimeDto, ['id', 'theaterId', 'movieId', 'startTime', 'endTime'])

    private toDtos = (showtimes: ShowtimeDocument[]) =>
        showtimes.map((showtime) => this.toDto(showtime))
}
