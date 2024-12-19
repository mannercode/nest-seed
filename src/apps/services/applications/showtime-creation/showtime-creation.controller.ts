import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaginationOption } from 'common'
import { ShowtimeCreationService } from './showtime-creation.service'
import { ShowtimeBatchCreateDto } from './dtos'

@Injectable()
export class ShowtimeCreationController {
    constructor(private service: ShowtimeCreationService) {}

    @MessagePattern({ cmd: 'showtime-creation.findMovies' })
    findMovies(@Payload() queryDto: PaginationOption) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern({ cmd: 'showtime-creation.findTheaters' })
    findTheaters(@Payload() queryDto: PaginationOption) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern({ cmd: 'showtime-creation.findShowtimes' })
    findShowtimes(@Payload() theaterIds: string[]) {
        return this.service.findShowtimes(theaterIds)
    }

    @MessagePattern({ cmd: 'showtime-creation.createBatchShowtimes' })
    createBatchShowtimes(@Payload() createDto: ShowtimeBatchCreateDto) {
        return this.service.createBatchShowtimes(createDto)
    }

    @MessagePattern({ cmd: 'showtime-creation.monitorEvents' })
    monitorEvents() {
        return this.service.monitorEvents()
    }
}
