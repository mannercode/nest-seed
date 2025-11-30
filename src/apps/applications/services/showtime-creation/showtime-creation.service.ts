import { Injectable } from '@nestjs/common'
import { MoviesClient, ShowtimesClient, TheatersClient } from 'apps/cores'
import { PaginationDto, OrderDirection } from 'common'
import { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos'
import { ShowtimeCreationWorkerService } from './services'

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private readonly theatersService: TheatersClient,
        private readonly moviesService: MoviesClient,
        private readonly showtimesService: ShowtimesClient,
        private readonly workerService: ShowtimeCreationWorkerService
    ) {}

    async searchMoviesPage(searchDto: PaginationDto) {
        return this.moviesService.searchPage({
            ...searchDto,
            orderby: { name: 'releaseDate', direction: OrderDirection.Desc }
        })
    }

    async searchTheatersPage(searchDto: PaginationDto) {
        return this.theatersService.searchPage(searchDto)
    }

    async searchShowtimes(theaterIds: string[]) {
        return this.showtimesService.search({ theaterIds, endTimeRange: { start: new Date() } })
    }

    async requestShowtimeCreation(createDto: BulkCreateShowtimesDto) {
        const transactionId = await this.workerService.requestShowtimeCreation(createDto)

        return { transactionId } as RequestShowtimeCreationResponse
    }
}
