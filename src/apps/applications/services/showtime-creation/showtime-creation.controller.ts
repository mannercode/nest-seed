import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaginationOptionDto } from 'common'
import { ShowtimeBatchCreateDto } from './dtos'
import { ShowtimeCreationService } from './showtime-creation.service'

@Controller()
export class ShowtimeCreationController {
    constructor(private service: ShowtimeCreationService) {}

    @MessagePattern('nestSeed.applications.showtimeCreation.findMovies')
    findMovies(@Payload() queryDto: PaginationOptionDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern('nestSeed.applications.showtimeCreation.findTheaters')
    findTheaters(@Payload() queryDto: PaginationOptionDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern('nestSeed.applications.showtimeCreation.findShowtimes')
    findShowtimes(@Payload() theaterIds: string[]) {
        return this.service.findShowtimes(theaterIds)
    }

    @MessagePattern('nestSeed.applications.showtimeCreation.createBatchShowtimes')
    createBatchShowtimes(@Payload() createDto: ShowtimeBatchCreateDto) {
        return this.service.createBatchShowtimes(createDto)
    }

    @MessagePattern('nestSeed.applications.showtimeCreation.monitorEvents')
    monitorEvents() {
        return this.service.monitorEvents()
    }
}
