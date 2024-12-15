import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { ShowtimeCreateDto, ShowtimeFilterDto } from 'types'
import { ShowtimesService } from './showtimes.service'

@Injectable()
export class ShowtimesController {
    constructor(private service: ShowtimesService) {}

    @MessagePattern({ cmd: 'createShowtimes' })
    async createShowtimes(@Payload() createDtos: ShowtimeCreateDto[]) {
        return this.service.createShowtimes(createDtos)
    }

    @MessagePattern({ cmd: 'getShowtimes' })
    async getShowtimes(@Payload() showtimeIds: string[]) {
        return this.service.getShowtimes(showtimeIds)
    }

    @MessagePattern({ cmd: 'findAllShowtimes' })
    async findAllShowtimes(@Payload() filterDto: ShowtimeFilterDto) {
        return this.service.findAllShowtimes(filterDto)
    }

    @MessagePattern({ cmd: 'findShowingMovieIds' })
    async findShowingMovieIds() {
        return this.service.findShowingMovieIds()
    }

    @MessagePattern({ cmd: 'findTheaterIdsByMovieId' })
    async findTheaterIdsByMovieId(@Payload() movieId: string) {
        return this.service.findTheaterIdsByMovieId(movieId)
    }

    @MessagePattern({ cmd: 'findShowdates' })
    async findShowdates(
        @Payload('movieId') movieId: string,
        @Payload('theaterId') theaterId: string
    ) {
        return this.service.findShowdates({ movieId, theaterId })
    }
}
