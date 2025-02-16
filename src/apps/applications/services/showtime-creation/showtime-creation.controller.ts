import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaginationOptionDto } from 'common'
import { ShowtimeBatchCreateDto } from './dtos'
import { ShowtimeCreationService } from './showtime-creation.service'

@Controller()
export class ShowtimeCreationController {
    constructor(private service: ShowtimeCreationService) {}

    @MessagePattern('applications.showtime-creation.findMovies')
    findMovies(@Payload() queryDto: PaginationOptionDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern('applications.showtime-creation.findTheaters')
    findTheaters(@Payload() queryDto: PaginationOptionDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern('applications.showtime-creation.findShowtimes')
    findShowtimes(@Payload() theaterIds: string[]) {
        return this.service.findShowtimes(theaterIds)
    }

    @MessagePattern('applications.showtime-creation.createBatchShowtimes')
    createBatchShowtimes(@Payload() createDto: ShowtimeBatchCreateDto) {
        return this.service.createBatchShowtimes(createDto)
    }

    @MessagePattern('applications.showtime-creation.monitorEvents')
    monitorEvents() {
        return this.service.monitorEvents()
    }
}
