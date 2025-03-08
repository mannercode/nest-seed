import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from './dtos'

@Injectable()
export class ShowtimesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    createShowtimes(createDtos: ShowtimeCreateDto[]): Promise<{ success: true; count: number }> {
        return this.service.getJson(Messages.Showtimes.createShowtimes, createDtos)
    }

    getShowtimes(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return this.service.getJson(Messages.Showtimes.getShowtimes, showtimeIds)
    }

    findAllShowtimes(filterDto: ShowtimeFilterDto): Promise<ShowtimeDto[]> {
        return this.service.getJson(Messages.Showtimes.findAllShowtimes, filterDto)
    }

    findShowingMovieIds(): Promise<string[]> {
        return this.service.getJson(Messages.Showtimes.findShowingMovieIds, {})
    }

    findTheaterIdsByMovieId(movieId: string): Promise<string[]> {
        return this.service.getJson(Messages.Showtimes.findTheaterIdsByMovieId, movieId)
    }

    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return this.service.getJson(Messages.Showtimes.findShowdates, args)
    }
}
