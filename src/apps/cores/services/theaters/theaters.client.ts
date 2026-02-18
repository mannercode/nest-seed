import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, PaginationResult } from 'common'
import { Messages } from 'shared'
import { CreateTheaterDto, SearchTheatersPageDto, TheaterDto, UpdateTheaterDto } from './dtos'

@Injectable()
export class TheatersClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreateTheaterDto): Promise<TheaterDto> {
        return this.proxy.request(Messages.Theaters.create, createDto)
    }

    update(theaterId: string, updateDto: UpdateTheaterDto): Promise<TheaterDto> {
        return this.proxy.request(Messages.Theaters.update, { theaterId, updateDto })
    }

    getMany(theaterIds: string[]): Promise<TheaterDto[]> {
        return this.proxy.request(Messages.Theaters.getMany, theaterIds)
    }

    async deleteMany(theaterIds: string[]): Promise<void> {
        await this.proxy.request(Messages.Theaters.deleteMany, theaterIds)
    }

    searchPage(searchDto: SearchTheatersPageDto): Promise<PaginationResult<TheaterDto>> {
        return this.proxy.request(Messages.Theaters.searchPage, searchDto)
    }

    existsAll(theaterIds: string[]): Promise<boolean> {
        return this.proxy.request(Messages.Theaters.existsAll, theaterIds)
    }
}
