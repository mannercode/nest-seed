import { Injectable } from '@nestjs/common'
import { MoviesClient, ShowtimesClient, TheatersClient } from 'apps/cores'
import { PaginationDto } from 'common'
import { OrderDirection } from 'common'
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
