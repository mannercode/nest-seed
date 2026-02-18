import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaginationDto } from 'common'
import { Messages } from 'shared'
import { BulkCreateShowtimesDto } from './dtos'
import { ShowtimeCreationService } from './showtime-creation.service'

@Controller()
export class ShowtimeCreationController {
    constructor(private readonly service: ShowtimeCreationService) {}

    @MessagePattern(Messages.ShowtimeCreation.requestShowtimeCreation)
    requestShowtimeCreation(@Payload() createDto: BulkCreateShowtimesDto) {
        return this.service.requestShowtimeCreation(createDto)
    }

    @MessagePattern(Messages.ShowtimeCreation.searchMoviesPage)
    searchMoviesPage(@Payload() searchDto: PaginationDto) {
        return this.service.searchMoviesPage(searchDto)
    }

    @MessagePattern(Messages.ShowtimeCreation.searchShowtimes)
    searchShowtimes(@Payload() theaterIds: string[]) {
        return this.service.searchShowtimes(theaterIds)
    }

    @MessagePattern(Messages.ShowtimeCreation.searchTheatersPage)
    searchTheatersPage(@Payload() searchDto: PaginationDto) {
        return this.service.searchTheatersPage(searchDto)
    }
}
