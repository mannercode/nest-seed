import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared/config'
import { ShowtimeCreateDto, ShowtimeFilterDto } from './dtos'
import { ShowtimesService } from './showtimes.service'

@Controller()
export class ShowtimesController {
    constructor(private service: ShowtimesService) {}

    @MessagePattern(Messages.Showtimes.createShowtimes)
    createShowtimes(
        @Payload(new ParseArrayPipe({ items: ShowtimeCreateDto })) createDtos: ShowtimeCreateDto[]
    ) {
        return this.service.createShowtimes(createDtos)
    }

    @MessagePattern(Messages.Showtimes.getShowtimes)
    getShowtimes(@Payload() showtimeIds: string[]) {
        return this.service.getShowtimes(showtimeIds)
    }

    @MessagePattern(Messages.Showtimes.findAllShowtimes)
    findAllShowtimes(@Payload() filterDto: ShowtimeFilterDto) {
        return this.service.findAllShowtimes(filterDto)
    }

    @MessagePattern(Messages.Showtimes.findShowingMovieIds)
    findShowingMovieIds() {
        return this.service.findShowingMovieIds()
    }

    @MessagePattern(Messages.Showtimes.findTheaterIdsByMovieId)
    findTheaterIdsByMovieId(@Payload() movieId: string) {
        return this.service.findTheaterIdsByMovieId(movieId)
    }

    @MessagePattern(Messages.Showtimes.findShowdates)
    findShowdates(@Payload('movieId') movieId: string, @Payload('theaterId') theaterId: string) {
        return this.service.findShowdates({ movieId, theaterId })
    }
}
