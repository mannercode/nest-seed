import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import type { CreateShowtimeDto, SearchShowtimesDto } from './dtos'
import type { Showtime } from './models'
import type { ShowtimesRepository } from './showtimes.repository'
import { ShowtimeDto } from './dtos'

@Injectable()
export class ShowtimesService {
    constructor(private readonly repository: ShowtimesRepository) {}

    async createMany(createDtos: CreateShowtimeDto[]) {
        await this.repository.createMany(createDtos)

        return { count: createDtos.length, success: true }
    }

    async existsAll(showtimeIds: string[]): Promise<boolean> {
        return this.repository.existsAll(showtimeIds)
    }

    async getMany(showtimeIds: string[]) {
        const showtimes = await this.repository.getByIds(showtimeIds)

        return this.toDtos(showtimes)
    }

    async search(searchDto: SearchShowtimesDto) {
        const showtimes = await this.repository.search(searchDto)

        return this.toDtos(showtimes)
    }

    async searchMovieIds(searchDto: SearchShowtimesDto) {
        return this.repository.searchMovieIds(searchDto)
    }

    async searchShowdates(searchDto: SearchShowtimesDto) {
        return this.repository.searchShowdates(searchDto)
    }

    async searchTheaterIds(searchDto: SearchShowtimesDto) {
        return this.repository.searchTheaterIds(searchDto)
    }

    private toDtos(showtimes: Showtime[]) {
        return showtimes.map((showtime) =>
            mapDocToDto(showtime, ShowtimeDto, [
                'id',
                'theaterId',
                'movieId',
                'startTime',
                'endTime'
            ])
        )
    }
}
