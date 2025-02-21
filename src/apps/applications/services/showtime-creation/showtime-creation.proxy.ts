import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    MethodLog,
    PaginationOptionDto
} from 'common'
import { MovieDto, ShowtimeDto, TheaterDto } from 'cores'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { ShowtimeBatchCreateDto, ShowtimeBatchCreateResponse } from './dtos'

@Injectable()
export class ShowtimeCreationProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: PaginationOptionDto): Promise<MovieDto[]> {
        return getProxyValue(this.service.send(Subjects.ShowtimeCreation.findMovies, queryDto))
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: PaginationOptionDto): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send(Subjects.ShowtimeCreation.findTheaters, queryDto))
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send(Subjects.ShowtimeCreation.findShowtimes, theaterIds))
    }

    @MethodLog({ level: 'verbose' })
    createBatchShowtimes(createDto: ShowtimeBatchCreateDto): Promise<ShowtimeBatchCreateResponse> {
        return getProxyValue(
            this.service.send(Subjects.ShowtimeCreation.createBatchShowtimes, createDto)
        )
    }
}
