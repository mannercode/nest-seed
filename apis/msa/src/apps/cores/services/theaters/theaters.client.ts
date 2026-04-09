import { PaginationResult } from '@mannercode/common'
import { ClientProxyService, InjectClientProxy } from '@mannercode/microservices'
import { Injectable } from '@nestjs/common'
import { Messages } from 'config'
import { SearchTheatersPageDto, TheaterDto } from './dtos'

@Injectable()
export class TheatersClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    allExist(theaterIds: string[]): Promise<boolean> {
        return this.proxy.request(Messages.Theaters.allExist, theaterIds)
    }

    getMany(theaterIds: string[]): Promise<TheaterDto[]> {
        return this.proxy.request(Messages.Theaters.getMany, theaterIds)
    }

    searchPage(searchDto: SearchTheatersPageDto): Promise<PaginationResult<TheaterDto>> {
        return this.proxy.request(Messages.Theaters.searchPage, searchDto)
    }
}
