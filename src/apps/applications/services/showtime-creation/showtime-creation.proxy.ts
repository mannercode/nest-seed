import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog, PaginationOptionDto } from 'common'
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
        return this.service.getJson(Messages.ShowtimeCreation.findMovies, queryDto)
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: PaginationOptionDto): Promise<TheaterDto[]> {
        return this.service.getJson(Messages.ShowtimeCreation.findTheaters, queryDto)
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return this.service.getJson(Messages.ShowtimeCreation.findShowtimes, theaterIds)
    }

    @MethodLog({ level: 'verbose' })
    createBatchShowtimes(createDto: ShowtimeBatchCreateDto): Promise<ShowtimeBatchCreateResponse> {
        return this.service.getJson(Messages.ShowtimeCreation.createBatchShowtimes, createDto)
    }
}
