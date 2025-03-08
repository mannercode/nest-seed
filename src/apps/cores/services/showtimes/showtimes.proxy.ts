import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from './dtos'

@Injectable()
export class ShowtimesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createShowtimes(createDtos: ShowtimeCreateDto[]): Promise<{ success: true; count: number }> {
        return this.service.getJson(Messages.Showtimes.createShowtimes, createDtos)
    }

    @MethodLog({ level: 'verbose' })
    getShowtimes(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return this.service.getJson(Messages.Showtimes.getShowtimes, showtimeIds)
    }

    @MethodLog({ level: 'verbose' })
    findAllShowtimes(filterDto: ShowtimeFilterDto): Promise<ShowtimeDto[]> {
        return this.service.getJson(Messages.Showtimes.findAllShowtimes, filterDto)
    }

    @MethodLog({ level: 'verbose' })
    findShowingMovieIds(): Promise<string[]> {
        return this.service.getJson(Messages.Showtimes.findShowingMovieIds, {})
    }

    @MethodLog({ level: 'verbose' })
    findTheaterIdsByMovieId(movieId: string): Promise<string[]> {
        return this.service.getJson(Messages.Showtimes.findTheaterIdsByMovieId, movieId)
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return this.service.getJson(Messages.Showtimes.findShowdates, args)
    }
}
