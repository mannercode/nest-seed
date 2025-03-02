import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    MethodLog,
    PaginationOptionDto
} from 'common'
import { MovieDto, ShowtimeDto, TheaterDto } from 'cores'
import { ClientProxyConfig, Messages } from 'shared/config'
import { ShowtimeBatchCreateDto, ShowtimeBatchCreateResponse } from './dtos'

@Injectable()
export class ShowtimeCreationProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: PaginationOptionDto): Promise<MovieDto[]> {
        return getProxyValue(this.service.send(Messages.ShowtimeCreation.findMovies, queryDto))
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: PaginationOptionDto): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send(Messages.ShowtimeCreation.findTheaters, queryDto))
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return getProxyValue(this.service.send(Messages.ShowtimeCreation.findShowtimes, theaterIds))
    }

    @MethodLog({ level: 'verbose' })
    createBatchShowtimes(createDto: ShowtimeBatchCreateDto): Promise<ShowtimeBatchCreateResponse> {
        return getProxyValue(
            this.service.send(Messages.ShowtimeCreation.createBatchShowtimes, createDto)
        )
    }
}
