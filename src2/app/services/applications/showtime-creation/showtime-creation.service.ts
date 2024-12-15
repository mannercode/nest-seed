import { Injectable } from '@nestjs/common'
import { MethodLog, newObjectId, PaginationOption } from 'common'
import { MoviesService, ShowtimesService, TheatersService } from 'services/cores'
import { ShowtimeBatchCreateDto, ShowtimeBatchCreateResponse } from './dtos'
import { ShowtimeCreationEventsService, ShowtimeCreationWorkerService } from './services'

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private theatersService: TheatersService,
        private moviesService: MoviesService,
        private showtimesService: ShowtimesService,
        private batchCreationService: ShowtimeCreationWorkerService,
        private eventService: ShowtimeCreationEventsService
    ) {}

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: PaginationOption) {
        return this.moviesService.findMovies(queryDto)
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: PaginationOption) {
        return this.theatersService.findTheaters(queryDto)
    }

    @MethodLog({ level: 'verbose' })
    async findShowtimes(theaterIds: string[]) {
        return this.showtimesService.findAllShowtimes({
            theaterIds,
            endTimeRange: { start: new Date() }
        })
    }

    @MethodLog()
    async createBatchShowtimes(createDto: ShowtimeBatchCreateDto) {
        const batchId = newObjectId()

        this.batchCreationService.enqueueTask({ ...createDto, batchId })

        return { batchId } as ShowtimeBatchCreateResponse
    }

    @MethodLog()
    monitorEvents() {
        return this.eventService.monitorEvents()
    }
}
