import type { MoviesClient, ShowtimesClient, TheatersClient } from 'apps/cores'
import type { PaginationDto } from 'common'
import { Injectable } from '@nestjs/common'
import { OrderDirection } from 'common'
import type { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos'
import type { ShowtimeCreationWorkerService } from './services'

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private readonly theatersClient: TheatersClient,
        private readonly moviesClient: MoviesClient,
        private readonly showtimesClient: ShowtimesClient,
        private readonly workerService: ShowtimeCreationWorkerService
    ) {}

    async requestShowtimeCreation(createDto: BulkCreateShowtimesDto) {
        const sagaId = await this.workerService.enqueueShowtimeCreationJob(createDto)

        return { sagaId } as RequestShowtimeCreationResponse
    }

    async searchMoviesPage(searchDto: PaginationDto) {
        return this.moviesClient.searchPage({
            ...searchDto,
            orderby: { direction: OrderDirection.Desc, name: 'releaseDate' }
        })
    }

    async searchShowtimes(theaterIds: string[]) {
        return this.showtimesClient.search({ endTimeRange: { start: new Date() }, theaterIds })
    }

    async searchTheatersPage(searchDto: PaginationDto) {
        return this.theatersClient.searchPage(searchDto)
    }
}
