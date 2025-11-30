import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreateShowtimeDto, SearchShowtimesDto, ShowtimeDto } from './dtos'
import { CreateShowtimesResult } from './types'

@Injectable()
export class ShowtimesClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    createMany(createDtos: CreateShowtimeDto[]): Promise<CreateShowtimesResult> {
        return this.proxy.getJson(Messages.Showtimes.createMany, createDtos)
    }

    getMany(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return this.proxy.getJson(Messages.Showtimes.getMany, showtimeIds)
    }

    search(searchDto: SearchShowtimesDto): Promise<ShowtimeDto[]> {
        return this.proxy.getJson(Messages.Showtimes.search, searchDto)
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

    allExistByIds(showtimeIds: string[]): Promise<boolean> {
        return this.proxy.getJson(Messages.Showtimes.allExist, showtimeIds)
    }
}
