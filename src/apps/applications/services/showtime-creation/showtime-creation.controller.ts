import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaginationOptionDto } from 'common'
import { Messages } from 'shared/config'
import { ShowtimeBatchCreateDto } from './dtos'
import { ShowtimeCreationService } from './showtime-creation.service'

@Controller()
export class ShowtimeCreationController {
    constructor(private service: ShowtimeCreationService) {}

    @MessagePattern(Messages.ShowtimeCreation.findMovies)
    findMovies(@Payload() queryDto: PaginationOptionDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern(Messages.ShowtimeCreation.findTheaters)
    findTheaters(@Payload() queryDto: PaginationOptionDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern(Messages.ShowtimeCreation.findShowtimes)
    findShowtimes(@Payload() theaterIds: string[]) {
        return this.service.findShowtimes(theaterIds)
    }

    @MessagePattern(Messages.ShowtimeCreation.createBatchShowtimes)
    createBatchShowtimes(@Payload() createDto: ShowtimeBatchCreateDto) {
        return this.service.createBatchShowtimes(createDto)
    }
}
