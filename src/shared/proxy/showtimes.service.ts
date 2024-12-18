import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from 'types'

@Injectable()
export class ShowtimesService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createShowtimes(createDtos: ShowtimeCreateDto[]): Promise<ShowtimeDto> {
        return getProxyValue(this.service.send('createShowtimes', createDtos))
    }

    @MethodLog({ level: 'verbose' })
    getShowtimes(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send('getShowtimes', showtimeIds))
    }

    @MethodLog({ level: 'verbose' })
    findAllShowtimes(filterDto: ShowtimeFilterDto): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send('findAllShowtimes', filterDto))
    }

    @MethodLog({ level: 'verbose' })
    findShowingMovieIds(): Promise<string[]> {
        return getProxyValue(this.service.send('findShowingMovieIds'))
    }

    @MethodLog({ level: 'verbose' })
    findTheaterIdsByMovieId(movieId: string): Promise<string[]> {
        return getProxyValue(this.service.send('findTheaterIdsByMovieId', movieId))
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return getProxyValue(this.service.send('findShowdates', args))
    }
}
