import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    MethodLog,
    PaginationOptionDto
} from 'common'
import { MovieDto, ShowtimeDto, TheaterDto } from 'cores'
import { ShowtimeBatchCreateDto, ShowtimeBatchCreateResponse } from './dtos'

@Injectable()
export class ShowtimeCreationProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: PaginationOptionDto): Promise<MovieDto[]> {
        return getProxyValue(
            this.service.send('applications.showtime-creation.findMovies', queryDto)
        )
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: PaginationOptionDto): Promise<TheaterDto[]> {
        return getProxyValue(
            this.service.send('applications.showtime-creation.findTheaters', queryDto)
        )
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return getProxyValue(
            this.service.send('applications.showtime-creation.findShowtimes', theaterIds)
        )
    }

    @MethodLog({ level: 'verbose' })
    createBatchShowtimes(createDto: ShowtimeBatchCreateDto): Promise<ShowtimeBatchCreateResponse> {
        return getProxyValue(
            this.service.send('applications.showtime-creation.createBatchShowtimes', createDto)
        )
    }
}
