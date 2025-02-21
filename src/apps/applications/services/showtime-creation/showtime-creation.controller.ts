import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaginationOptionDto } from 'common'
import { Subjects } from 'shared/config'
import { ShowtimeBatchCreateDto } from './dtos'
import { ShowtimeCreationService } from './showtime-creation.service'

@Controller()
export class ShowtimeCreationController {
    constructor(private service: ShowtimeCreationService) {}

    @MessagePattern(Subjects.ShowtimeCreation.findMovies)
    findMovies(@Payload() queryDto: PaginationOptionDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern(Subjects.ShowtimeCreation.findTheaters)
    findTheaters(@Payload() queryDto: PaginationOptionDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern(Subjects.ShowtimeCreation.findShowtimes)
    findShowtimes(@Payload() theaterIds: string[]) {
        return this.service.findShowtimes(theaterIds)
    }

    @MessagePattern(Subjects.ShowtimeCreation.createBatchShowtimes)
    createBatchShowtimes(@Payload() createDto: ShowtimeBatchCreateDto) {
        return this.service.createBatchShowtimes(createDto)
    }
}
