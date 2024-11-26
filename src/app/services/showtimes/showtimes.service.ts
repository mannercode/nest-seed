import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { ShowtimeCreateDto, ShowtimeFilterDto } from './dtos'
import { ShowtimeDocument, ShowtimeDto } from './models'
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
    async getShowtime(showtimeId: string) {
        const showtime = await this.repository.getById(showtimeId)

        return this.toDto(showtime)
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

    private toDto = (showtime: ShowtimeDocument) => showtime.toJSON<ShowtimeDto>()
    private toDtos = (showtimes: ShowtimeDocument[]) =>
        showtimes.map((showtime) => this.toDto(showtime))
}
