import { mapDocToDto } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { CreateShowtimeDto, SearchShowtimesDto } from './dtos'
import { ShowtimeDto } from './dtos'
import { Showtime } from './models'
import { ShowtimesRepository } from './showtimes.repository'

@Injectable()
export class ShowtimesService {
    constructor(private readonly repository: ShowtimesRepository) {}

    async deleteBySagaIds(sagaIds: string[]) {
        await this.repository.deleteBySagaIds(sagaIds)
    }

    async createMany(createDtos: CreateShowtimeDto[]) {
        await this.repository.createMany(createDtos)

        return { count: createDtos.length, success: true }
    }

    async allExist(showtimeIds: string[]): Promise<boolean> {
        return this.repository.allExist(showtimeIds)
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
