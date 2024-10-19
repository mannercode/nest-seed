import { Injectable } from '@nestjs/common'
import { MethodLog, newObjectId, PaginationOption } from 'common'
import { MoviesService } from 'services/movies'
import { ShowtimesService } from 'services/showtimes'
import { TheatersService } from 'services/theaters'
import { ShowtimeBatchCreationDto, ShowtimeBatchCreationResponse } from './dto'
import { ShowtimeCreationEventsService, ShowtimeCreationProcessorService } from './services'

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private theatersService: TheatersService,
        private moviesService: MoviesService,
        private showtimesService: ShowtimesService,
        private batchCreationService: ShowtimeCreationProcessorService,
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
    async createBatchShowtimes(creationDto: ShowtimeBatchCreationDto) {
        const batchId = newObjectId()

        this.batchCreationService.enqueueTask({ ...creationDto, batchId })

        return { batchId } as ShowtimeBatchCreationResponse
    }

    @MethodLog()
    monitorEvents() {
        return this.eventService.monitorEvents()
    }
}
