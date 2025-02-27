import { Injectable } from '@nestjs/common'
import { MethodLog, newObjectId, PaginationOptionDto } from 'common'
import { MoviesProxy, ShowtimesProxy, TheatersProxy } from 'cores'
import { ShowtimeBatchCreateDto, ShowtimeBatchCreateResponse } from './dtos'
import { ShowtimeCreationWorkerService } from './services'

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private theatersService: TheatersProxy,
        private moviesService: MoviesProxy,
        private showtimesService: ShowtimesProxy,
        private batchCreationService: ShowtimeCreationWorkerService
    ) {}

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: PaginationOptionDto) {
        return this.moviesService.findMovies(queryDto)
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: PaginationOptionDto) {
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
}
