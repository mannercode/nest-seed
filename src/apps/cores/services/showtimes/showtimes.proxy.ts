import { Injectable } from '@nestjs/common';
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common';
import { Routes } from 'shared/config';
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from './dtos';

@Injectable()
export class ShowtimesProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createShowtimes(createDtos: ShowtimeCreateDto[]): Promise<{ success: true; count: number }> {
        return getProxyValue(this.service.send(Routes.Messages.Showtimes.createShowtimes, createDtos))
    }

    @MethodLog({ level: 'verbose' })
    getShowtimes(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send(Routes.Messages.Showtimes.getShowtimes, showtimeIds))
    }

    @MethodLog({ level: 'verbose' })
    findAllShowtimes(filterDto: ShowtimeFilterDto): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send(Routes.Messages.Showtimes.findAllShowtimes, filterDto))
    }

    @MethodLog({ level: 'verbose' })
    findShowingMovieIds(): Promise<string[]> {
        return getProxyValue(this.service.send(Routes.Messages.Showtimes.findShowingMovieIds, {}))
    }

    @MethodLog({ level: 'verbose' })
    findTheaterIdsByMovieId(movieId: string): Promise<string[]> {
        return getProxyValue(this.service.send(Routes.Messages.Showtimes.findTheaterIdsByMovieId, movieId))
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return getProxyValue(this.service.send(Routes.Messages.Showtimes.findShowdates, args))
    }
}
