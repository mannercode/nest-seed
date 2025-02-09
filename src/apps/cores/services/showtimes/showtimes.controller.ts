import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { ShowtimeCreateDto, ShowtimeFilterDto } from './dtos'
import { ShowtimesService } from './showtimes.service'

@Controller()
export class ShowtimesController {
    constructor(private service: ShowtimesService) {}

    @MessagePattern('nestSeed.cores.showtimes.createShowtimes')
    createShowtimes(
        @Payload(new ParseArrayPipe({ items: ShowtimeCreateDto })) createDtos: ShowtimeCreateDto[]
    ) {
        return this.service.createShowtimes(createDtos)
    }

    @MessagePattern('nestSeed.cores.showtimes.getShowtimes')
    getShowtimes(@Payload() showtimeIds: string[]) {
        return this.service.getShowtimes(showtimeIds)
    }

    @MessagePattern('nestSeed.cores.showtimes.findAllShowtimes')
    findAllShowtimes(@Payload() filterDto: ShowtimeFilterDto) {
        return this.service.findAllShowtimes(filterDto)
    }

    @MessagePattern('nestSeed.cores.showtimes.findShowingMovieIds')
    findShowingMovieIds() {
        return this.service.findShowingMovieIds()
    }

    @MessagePattern('nestSeed.cores.showtimes.findTheaterIdsByMovieId')
    findTheaterIdsByMovieId(@Payload() movieId: string) {
        return this.service.findTheaterIdsByMovieId(movieId)
    }

    @MessagePattern('nestSeed.cores.showtimes.findShowdates')
    findShowdates(@Payload('movieId') movieId: string, @Payload('theaterId') theaterId: string) {
        return this.service.findShowdates({ movieId, theaterId })
    }
}
