import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreateShowtimeDto, SearchShowtimesDto, ShowtimeDto } from './dtos'
import { ShowtimeDocument } from './models'
import { ShowtimesRepository } from './showtimes.repository'

@Injectable()
export class ShowtimesService {
    constructor(private readonly repository: ShowtimesRepository) {}

    async createMany(createDtos: CreateShowtimeDto[]) {
        await this.repository.createMany(createDtos)

        return { success: true, count: createDtos.length }
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

    async searchTheaterIds(searchDto: SearchShowtimesDto) {
        return this.repository.searchTheaterIds(searchDto)
    }

    async searchShowdates(searchDto: SearchShowtimesDto) {
        return this.repository.searchShowdates(searchDto)
    }

    async deleteBySagaIds(sagaIds: string[]) {
        await this.repository.deleteBySagaIds(sagaIds)
        return {}
    }

    async allExist(showtimeIds: string[]): Promise<boolean> {
        return this.repository.allExist(showtimeIds)
    }

    private toDtos(showtimes: ShowtimeDocument[]) {
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
