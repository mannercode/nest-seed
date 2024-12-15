import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { ShowtimeCreateDto, ShowtimeDto, ShowtimeFilterDto } from 'types'

@Injectable()
export class ShowtimesService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createShowtimes(createDtos: ShowtimeCreateDto[]): Observable<ShowtimeDto> {
        return this.service.send('createShowtimes', createDtos)
    }

    @MethodLog({ level: 'verbose' })
    getShowtimes(showtimeIds: string[]): Observable<ShowtimeDto[]> {
        return this.service.send('getShowtimes', showtimeIds)
    }

    @MethodLog({ level: 'verbose' })
    findAllShowtimes(filterDto: ShowtimeFilterDto): Observable<ShowtimeDto[]> {
        return this.service.send('findAllShowtimes', filterDto)
    }

    @MethodLog({ level: 'verbose' })
    findShowingMovieIds(): Observable<string[]> {
        return this.service.send('findShowingMovieIds')
    }

    @MethodLog({ level: 'verbose' })
    findTheaterIdsByMovieId(movieId: string): Observable<string[]> {
        return this.service.send('findTheaterIdsByMovieId', movieId)
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Observable<Date[]> {
        return this.service.send('findShowdates', args)
    }
}
