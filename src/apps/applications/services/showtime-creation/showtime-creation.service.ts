import { Injectable } from '@nestjs/common'
import { MoviesClient, ShowtimesClient, TheatersClient } from 'apps/cores'
import { PaginationDto, OrderDirection } from 'common'
import { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos'
import { ShowtimeCreationWorkerService } from './services'

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private readonly theatersClient: TheatersClient,
        private readonly moviesClient: MoviesClient,
        private readonly showtimesClient: ShowtimesClient,
        private readonly workerService: ShowtimeCreationWorkerService
    ) {}

    async searchMoviesPage(searchDto: PaginationDto) {
        return this.moviesClient.searchPage({
            ...searchDto,
            orderby: { name: 'releaseDate', direction: OrderDirection.Desc }
        })
    }

    async searchTheatersPage(searchDto: PaginationDto) {
        return this.theatersClient.searchPage(searchDto)
    }

    async searchShowtimes(theaterIds: string[]) {
        return this.showtimesClient.search({ theaterIds, endTimeRange: { start: new Date() } })
    }

    async requestShowtimeCreation(createDto: BulkCreateShowtimesDto) {
        const sagaId = await this.workerService.enqueueShowtimeCreationJob(createDto)

        return { sagaId } as RequestShowtimeCreationResponse
    }
}
