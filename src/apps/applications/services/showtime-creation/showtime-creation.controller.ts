import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaginationOption } from 'common'
import { ShowtimeBatchCreateDto } from './dtos'
import { ShowtimeCreationService } from './showtime-creation.service'

@Controller()
export class ShowtimeCreationController {
    constructor(private service: ShowtimeCreationService) {}

    @MessagePattern('applications.showtimeCreation.findMovies')
    findMovies(@Payload() queryDto: PaginationOption) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern('applications.showtimeCreation.findTheaters')
    findTheaters(@Payload() queryDto: PaginationOption) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern('applications.showtimeCreation.findShowtimes')
    findShowtimes(@Payload() theaterIds: string[]) {
        return this.service.findShowtimes(theaterIds)
    }

    @MessagePattern('applications.showtimeCreation.createBatchShowtimes')
    createBatchShowtimes(@Payload() createDto: ShowtimeBatchCreateDto) {
        return this.service.createBatchShowtimes(createDto)
    }

    @MessagePattern('applications.showtimeCreation.monitorEvents')
    monitorEvents() {
        return this.service.monitorEvents()
    }
}
