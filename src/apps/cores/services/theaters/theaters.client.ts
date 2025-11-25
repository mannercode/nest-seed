import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, PaginationResult } from 'common'
import { Messages } from 'shared'
import {
    CreateTheaterDto,
    DeleteTheatersResponse,
    SearchTheatersPageDto,
    TheaterDto,
    UpdateTheaterDto
} from './dtos'

@Injectable()
export class TheatersClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    create(createDto: CreateTheaterDto): Promise<TheaterDto> {
        return this.proxy.getJson(Messages.Theaters.create, createDto)
    }

    update(theaterId: string, updateDto: UpdateTheaterDto): Promise<TheaterDto> {
        return this.proxy.getJson(Messages.Theaters.update, { theaterId, updateDto })
    }

    getMany(theaterIds: string[]): Promise<TheaterDto[]> {
        return this.proxy.getJson(Messages.Theaters.getMany, theaterIds)
    }

    deleteMany(theaterIds: string[]): Promise<DeleteTheatersResponse> {
        return this.proxy.getJson(Messages.Theaters.deleteMany, theaterIds)
    }

    searchPage(searchDto: SearchTheatersPageDto): Promise<PaginationResult<TheaterDto>> {
        return this.proxy.getJson(Messages.Theaters.searchPage, searchDto)
    }

    exists(theaterIds: string[]): Promise<boolean> {
        return this.proxy.getJson(Messages.Theaters.exists, theaterIds)
    }
}
