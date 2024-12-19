import { Injectable } from '@nestjs/common'
import { ShowtimeBatchCreateDto, ShowtimeBatchCreateResponse } from 'applications'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    MethodLog,
    PaginationOption
} from 'common'
import { MovieDto, ShowtimeDto, TheaterDto } from 'cores'
import { Observable } from 'rxjs'

@Injectable()
export class ShowtimeCreationService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: PaginationOption): Promise<MovieDto[]> {
        return getProxyValue(this.service.send('showtime-creation.findMovies', queryDto))
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: PaginationOption): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send('showtime-creation.findTheaters', queryDto))
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send('showtime-creation.findShowtimes', theaterIds))
    }

    @MethodLog({ level: 'verbose' })
    createBatchShowtimes(createDto: ShowtimeBatchCreateDto): Promise<ShowtimeBatchCreateResponse> {
        return getProxyValue(this.service.send('showtime-creation.createBatchShowtimes', createDto))
    }

    @MethodLog({ level: 'verbose' })
    monitorEvents(): Observable<MessageEvent> {
        return this.service.send('showtime-creation.monitorEvents')
    }
}
