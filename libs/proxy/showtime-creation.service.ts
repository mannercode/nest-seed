import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog, PaginationOption } from 'common'
import { Observable } from 'rxjs'
import {
    MovieDto,
    ShowtimeBatchCreateDto,
    ShowtimeBatchCreateResponse,
    ShowtimeDto,
    TheaterDto
} from 'types'

@Injectable()
export class ShowtimeCreationService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: PaginationOption): Observable<MovieDto[]> {
        return this.service.send('showtime-creation.findMovies', queryDto)
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: PaginationOption): Observable<TheaterDto[]> {
        return this.service.send('showtime-creation.findTheaters', queryDto)
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(theaterIds: string[]): Observable<ShowtimeDto[]> {
        return this.service.send('showtime-creation.findShowtimes', theaterIds)
    }

    @MethodLog({ level: 'verbose' })
    createBatchShowtimes(
        createDto: ShowtimeBatchCreateDto
    ): Observable<ShowtimeBatchCreateResponse> {
        return this.service.send('showtime-creation.createBatchShowtimes', createDto)
    }

    @MethodLog({ level: 'verbose' })
    monitorEvents(): Observable<MessageEvent> {
        return this.service.send('showtime-creation.monitorEvents')
    }
}
