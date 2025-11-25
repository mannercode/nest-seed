import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreateShowtimeDto, SearchShowtimesDto } from './dtos'
import { ShowtimesService } from './showtimes.service'
import { CreateShowtimesResult } from './types'

@Controller()
export class ShowtimesController {
    constructor(private service: ShowtimesService) {}

    @MessagePattern(Messages.Showtimes.createMany)
    createMany(
        @Payload(new ParseArrayPipe({ items: CreateShowtimeDto })) createDtos: CreateShowtimeDto[]
    ): Promise<CreateShowtimesResult> {
        return this.service.createMany(createDtos)
    }

    @MessagePattern(Messages.Showtimes.getMany)
    getMany(@Payload() showtimeIds: string[]) {
        return this.service.getMany(showtimeIds)
    }

    @MessagePattern(Messages.Showtimes.search)
    search(@Payload() searchDto: SearchShowtimesDto) {
        return this.service.search(searchDto)
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

    @MessagePattern(Messages.Showtimes.allExist)
    exists(@Payload() showtimeIds: string[]) {
        return this.service.allExist(showtimeIds)
    }
}
