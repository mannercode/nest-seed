import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreateShowtimeDto, SearchShowtimesDto } from './dtos'
import { ShowtimesService } from './showtimes.service'
import { CreateShowtimesResult } from './types'

@Controller()
export class ShowtimesController {
    constructor(private service: ShowtimesService) {}

    @MessagePattern(Messages.Showtimes.createShowtimes)
    createShowtimes(
        @Payload(new ParseArrayPipe({ items: CreateShowtimeDto })) createDtos: CreateShowtimeDto[]
    ): Promise<CreateShowtimesResult> {
        return this.service.createShowtimes(createDtos)
    }

    @MessagePattern(Messages.Showtimes.getShowtimes)
    getShowtimes(@Payload() showtimeIds: string[]) {
        return this.service.getShowtimes(showtimeIds)
    }

    @MessagePattern(Messages.Showtimes.searchShowtimes)
    searchShowtimes(@Payload() searchDto: SearchShowtimesDto) {
        return this.service.searchShowtimes(searchDto)
    }

    @MessagePattern(Messages.Showtimes.searchMovieIds)
    searchMovieIds(@Payload() searchDto: SearchShowtimesDto) {
        return this.service.searchMovieIds(searchDto)
    }

    @MessagePattern(Messages.Showtimes.searchTheaterIds)
    searchTheaterIds(@Payload() searchDto: SearchShowtimesDto) {
        return this.service.searchTheaterIds(searchDto)
    }

    @MessagePattern(Messages.Showtimes.searchShowdates)
    searchShowdates(searchDto: SearchShowtimesDto) {
        return this.service.searchShowdates(searchDto)
    }

    @MessagePattern(Messages.Showtimes.allShowtimesExist)
    allShowtimesExist(@Payload() showtimeIds: string[]) {
        return this.service.allShowtimesExist(showtimeIds)
    }
}
