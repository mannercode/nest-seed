import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { nullShowtimeDto, ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from 'types'

@Injectable()
export class ShowtimesService {
    constructor() {}

    @MethodLog()
    async createShowtimes(createDtos: ShowtimeCreateDto[]): Promise<ShowtimeDto> {
        return nullShowtimeDto
    }

    @MethodLog({ level: 'verbose' })
    async getShowtimes(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findAllShowtimes(filterDto: ShowtimeFilterDto): Promise<ShowtimeDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findShowingMovieIds(): Promise<string[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findTheaterIdsByMovieId(movieId: string): Promise<string[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return []
    }
}
