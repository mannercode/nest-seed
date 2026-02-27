import { Inject, Injectable } from '@nestjs/common'
import { Client } from '@temporalio/client'
import { MoviesClient, ShowtimesClient, TheatersClient } from 'apps/cores'
import { newObjectIdString, PaginationDto } from 'common'
import { OrderDirection } from 'common'
import { TEMPORAL_CLIENT } from 'common'
import { getTemporalTaskQueue } from 'shared'
import { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos'
import { ShowtimeCreationStatus } from './services/types'
import { ShowtimeCreationEvents } from './showtime-creation.events'

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private readonly theatersClient: TheatersClient,
        private readonly moviesClient: MoviesClient,
        private readonly showtimesClient: ShowtimesClient,
        private readonly events: ShowtimeCreationEvents,
        @Inject(TEMPORAL_CLIENT) private readonly temporalClient: Client
    ) {}

    async requestShowtimeCreation(createDto: BulkCreateShowtimesDto) {
        const sagaId = newObjectIdString()

        await this.events.emitStatusChanged({ sagaId, status: ShowtimeCreationStatus.Waiting })

        await this.temporalClient.workflow.start('showtimeCreationWorkflow', {
            taskQueue: getTemporalTaskQueue(),
            workflowId: `showtime-creation-${sagaId}`,
            args: [{ sagaId, createDto }]
        })

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
