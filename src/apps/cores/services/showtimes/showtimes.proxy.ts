import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from './dtos'

@Injectable()
export class ShowtimesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createShowtimes(createDtos: ShowtimeCreateDto[]): Promise<{ success: true; count: number }> {
        return getProxyValue(this.service.send(Subjects.Showtimes.createShowtimes, createDtos))
    }

    @MethodLog({ level: 'verbose' })
    getShowtimes(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send(Subjects.Showtimes.getShowtimes, showtimeIds))
    }

    @MethodLog({ level: 'verbose' })
    findAllShowtimes(filterDto: ShowtimeFilterDto): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send(Subjects.Showtimes.findAllShowtimes, filterDto))
    }

    @MethodLog({ level: 'verbose' })
    findShowingMovieIds(): Promise<string[]> {
        return getProxyValue(this.service.send(Subjects.Showtimes.findShowingMovieIds, {}))
    }

    @MethodLog({ level: 'verbose' })
    findTheaterIdsByMovieId(movieId: string): Promise<string[]> {
        return getProxyValue(this.service.send(Subjects.Showtimes.findTheaterIdsByMovieId, movieId))
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return getProxyValue(this.service.send(Subjects.Showtimes.findShowdates, args))
    }
}
