import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Subjects } from 'shared/config'
import { ShowtimeCreateDto, ShowtimeFilterDto } from './dtos'
import { ShowtimesService } from './showtimes.service'

@Controller()
export class ShowtimesController {
    constructor(private service: ShowtimesService) {}

    @MessagePattern(Subjects.Showtimes.createShowtimes)
    createShowtimes(
        @Payload(new ParseArrayPipe({ items: ShowtimeCreateDto })) createDtos: ShowtimeCreateDto[]
    ) {
        return this.service.createShowtimes(createDtos)
    }

    @MessagePattern(Subjects.Showtimes.getShowtimes)
    getShowtimes(@Payload() showtimeIds: string[]) {
        return this.service.getShowtimes(showtimeIds)
    }

    @MessagePattern(Subjects.Showtimes.findAllShowtimes)
    findAllShowtimes(@Payload() filterDto: ShowtimeFilterDto) {
        return this.service.findAllShowtimes(filterDto)
    }

    @MessagePattern(Subjects.Showtimes.findShowingMovieIds)
    findShowingMovieIds() {
        return this.service.findShowingMovieIds()
    }

    @MessagePattern(Subjects.Showtimes.findTheaterIdsByMovieId)
    findTheaterIdsByMovieId(@Payload() movieId: string) {
        return this.service.findTheaterIdsByMovieId(movieId)
    }

    @MessagePattern(Subjects.Showtimes.findShowdates)
    findShowdates(@Payload('movieId') movieId: string, @Payload('theaterId') theaterId: string) {
        return this.service.findShowdates({ movieId, theaterId })
    }
}
