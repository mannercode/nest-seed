import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreateShowtimeDto, CreateShowtimesResult, SearchShowtimesDto, ShowtimeDto } from './dtos'

@Injectable()
export class ShowtimesClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    deleteBySagaIds(sagaIds: string[]): Promise<void> {
        return this.proxy.request(Messages.Showtimes.deleteBySagaIds, sagaIds)
    }

    createMany(createDtos: CreateShowtimeDto[]): Promise<CreateShowtimesResult> {
        return this.proxy.request(Messages.Showtimes.createMany, createDtos)
    }

    allExist(showtimeIds: string[]): Promise<boolean> {
        return this.proxy.request(Messages.Showtimes.allExist, showtimeIds)
    }

    getMany(showtimeIds: string[]): Promise<ShowtimeDto[]> {
        return this.proxy.request(Messages.Showtimes.getMany, showtimeIds)
    }

    search(searchDto: SearchShowtimesDto): Promise<ShowtimeDto[]> {
        return this.proxy.request(Messages.Showtimes.search, searchDto)
    }

    searchMovieIds(searchDto: SearchShowtimesDto): Promise<string[]> {
        return this.proxy.request(Messages.Showtimes.searchMovieIds, searchDto)
    }

    searchShowdates(searchDto: SearchShowtimesDto): Promise<Date[]> {
        return this.proxy.request(Messages.Showtimes.searchShowdates, searchDto)
    }

    searchTheaterIds(searchDto: SearchShowtimesDto): Promise<string[]> {
        return this.proxy.request(Messages.Showtimes.searchTheaterIds, searchDto)
    }
}
