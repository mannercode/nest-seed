import type { ClientProxyService } from 'common'
import { Injectable } from '@nestjs/common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import type {
    CreateShowtimeDto,
    CreateShowtimesResult,
    SearchShowtimesDto,
    ShowtimeDto
} from './dtos'

@Injectable()
export class ShowtimesClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    createMany(createDtos: CreateShowtimeDto[]): Promise<CreateShowtimesResult> {
        return this.proxy.request(Messages.Showtimes.createMany, createDtos)
    }

    existsAll(showtimeIds: string[]): Promise<boolean> {
        return this.proxy.request(Messages.Showtimes.existsAll, showtimeIds)
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
