import { Injectable, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { ShowtimeCreateDto, ShowtimeFilterDto } from './dtos'
import { ShowtimesService } from './showtimes.service'

@Injectable()
export class ShowtimesController {
    constructor(private service: ShowtimesService) {}

    @MessagePattern({ cmd: 'createShowtimes' })
    createShowtimes(
        @Payload(new ParseArrayPipe({ items: ShowtimeCreateDto })) createDtos: ShowtimeCreateDto[]
    ) {
        return this.service.createShowtimes(createDtos)
    }

    @MessagePattern({ cmd: 'getShowtimes' })
    getShowtimes(@Payload() showtimeIds: string[]) {
        return this.service.getShowtimes(showtimeIds)
    }

    @MessagePattern({ cmd: 'findAllShowtimes' })
    findAllShowtimes(@Payload() filterDto: ShowtimeFilterDto) {
        return this.service.findAllShowtimes(filterDto)
    }

    @MessagePattern({ cmd: 'findShowingMovieIds' })
    findShowingMovieIds() {
        return this.service.findShowingMovieIds()
    }

    @MessagePattern({ cmd: 'findTheaterIdsByMovieId' })
    findTheaterIdsByMovieId(@Payload() movieId: string) {
        return this.service.findTheaterIdsByMovieId(movieId)
    }

    @MessagePattern({ cmd: 'findShowdates' })
    findShowdates(@Payload('movieId') movieId: string, @Payload('theaterId') theaterId: string) {
        return this.service.findShowdates({ movieId, theaterId })
    }
}
