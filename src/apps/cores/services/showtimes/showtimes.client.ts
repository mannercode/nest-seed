import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreateShowtimeDto, SearchShowtimesDto, ShowtimeDto } from './dtos'
import { CreateShowtimesResult } from './types'

@Injectable()
export class ShowtimesClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    createShowtimes(createDtos: CreateShowtimeDto[]): Promise<CreateShowtimesResult> {
        return this.proxy.getJson(Messages.Showtimes.createShowtimes, createDtos)
    }

    getShowtimes(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return this.proxy.getJson(Messages.Showtimes.getShowtimes, showtimeIds)
    }

    searchShowtimes(searchDto: SearchShowtimesDto): Promise<ShowtimeDto[]> {
        return this.proxy.getJson(Messages.Showtimes.searchShowtimes, searchDto)
    }

    searchMovieIds(searchDto: SearchShowtimesDto): Promise<string[]> {
        return this.proxy.getJson(Messages.Showtimes.searchMovieIds, searchDto)
    }

    searchTheaterIds(searchDto: SearchShowtimesDto): Promise<string[]> {
        return this.proxy.getJson(Messages.Showtimes.searchTheaterIds, searchDto)
    }

    searchShowdates(searchDto: SearchShowtimesDto): Promise<Date[]> {
        return this.proxy.getJson(Messages.Showtimes.searchShowdates, searchDto)
    }

    allShowtimesExist(showtimeIds: string[]): Promise<boolean> {
        return this.proxy.getJson(Messages.Showtimes.allShowtimesExist, showtimeIds)
    }
}
