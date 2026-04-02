import { PaginationDto, PaginationResult } from '@mannercode/common'
import { ClientProxyService } from '@mannercode/microservices'
import { InjectClientProxy } from '@mannercode/microservices'
import { Injectable } from '@nestjs/common'
import { MovieDto, ShowtimeDto, TheaterDto } from 'apps/cores'
import { Messages } from 'config'
import { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos'

@Injectable()
export class ShowtimeCreationClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    requestShowtimeCreation(
        createDto: BulkCreateShowtimesDto
    ): Promise<RequestShowtimeCreationResponse> {
        return this.proxy.request(Messages.ShowtimeCreation.requestShowtimeCreation, createDto)
    }

    searchMoviesPage(searchDto: PaginationDto): Promise<PaginationResult<MovieDto>> {
        return this.proxy.request(Messages.ShowtimeCreation.searchMoviesPage, searchDto)
    }

    searchShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return this.proxy.request(Messages.ShowtimeCreation.searchShowtimes, theaterIds)
    }

    searchTheatersPage(searchDto: PaginationDto): Promise<PaginationResult<TheaterDto>> {
        return this.proxy.request(Messages.ShowtimeCreation.searchTheatersPage, searchDto)
    }
}
