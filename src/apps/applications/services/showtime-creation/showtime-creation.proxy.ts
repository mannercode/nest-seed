import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, PaginationOptionDto } from 'common'
import { MovieDto, ShowtimeDto, TheaterDto } from 'cores'
import { ClientProxyConfig, Messages } from 'shared/config'
import { ShowtimeBatchCreateDto, ShowtimeBatchCreateResponse } from './dtos'

@Injectable()
export class ShowtimeCreationProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    findMovies(queryDto: PaginationOptionDto): Promise<MovieDto[]> {
        return this.service.getJson(Messages.ShowtimeCreation.findMovies, queryDto)
    }

    findTheaters(queryDto: PaginationOptionDto): Promise<TheaterDto[]> {
        return this.service.getJson(Messages.ShowtimeCreation.findTheaters, queryDto)
    }

    findShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return this.service.getJson(Messages.ShowtimeCreation.findShowtimes, theaterIds)
    }

    createBatchShowtimes(createDto: ShowtimeBatchCreateDto): Promise<ShowtimeBatchCreateResponse> {
        return this.service.getJson(Messages.ShowtimeCreation.createBatchShowtimes, createDto)
    }
}
