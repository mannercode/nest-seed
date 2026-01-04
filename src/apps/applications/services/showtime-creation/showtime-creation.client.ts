import { Injectable } from '@nestjs/common'
import { MovieDto, ShowtimeDto, TheaterDto } from 'apps/cores'
import { ClientProxyService, PaginationDto, InjectClientProxy, PaginationResult } from 'common'
import { Messages } from 'shared'
import { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos'

@Injectable()
export class ShowtimeCreationClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchMoviesPage(searchDto: PaginationDto): Promise<PaginationResult<MovieDto>> {
        return this.proxy.request(Messages.ShowtimeCreation.searchMoviesPage, searchDto)
    }

    searchTheatersPage(searchDto: PaginationDto): Promise<PaginationResult<TheaterDto>> {
        return this.proxy.request(Messages.ShowtimeCreation.searchTheatersPage, searchDto)
    }

    searchShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return this.proxy.request(Messages.ShowtimeCreation.searchShowtimes, theaterIds)
    }

    requestShowtimeCreation(
        createDto: BulkCreateShowtimesDto
    ): Promise<RequestShowtimeCreationResponse> {
        return this.proxy.request(Messages.ShowtimeCreation.requestShowtimeCreation, createDto)
    }
}
