import type { ClientSession } from 'mongoose'
import { mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import {
    CreateShowtimeDto,
    CreateShowtimesResult,
    SearchShowtimesDto,
    ShowtimeDto
} from './dtos/index.js'
import { Showtime } from './models/index.js'
import { ShowtimesRepository } from './showtimes.repository.js'

@Injectable()
export class ShowtimesService {
    constructor(private readonly repository: ShowtimesRepository) {}

    async createMany(
        createDtos: CreateShowtimeDto[],
        session: ClientSession | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<CreateShowtimesResult> {
        await this.repository.createMany(createDtos, session, signal)

        return { count: createDtos.length }
    }

    async allExist(showtimeIds: string[]): Promise<boolean> {
        return this.repository.allExist(showtimeIds)
    }

    async existsByMovieIds(movieIds: string[]): Promise<boolean> {
        return this.repository.existsByMovieIds(movieIds)
    }

    async existsByTheaterIds(theaterIds: string[]): Promise<boolean> {
        return this.repository.existsByTheaterIds(theaterIds)
    }

    async getMany(showtimeIds: string[]) {
        const showtimes = await this.repository.getByIds(showtimeIds)

        return this.toDtos(showtimes)
    }

    async search(
        searchDto: SearchShowtimesDto,
        session: ClientSession | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const showtimes = await this.repository.search(searchDto, session, signal)

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
