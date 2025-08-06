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

    createTheater(createDto: CreateTheaterDto): Promise<TheaterDto> {
        return this.proxy.getJson(Messages.Theaters.createTheater, createDto)
    }

    updateTheater(theaterId: string, updateDto: UpdateTheaterDto): Promise<TheaterDto> {
        return this.proxy.getJson(Messages.Theaters.updateTheater, { theaterId, updateDto })
    }

    getTheaters(theaterIds: string[]): Promise<TheaterDto[]> {
        return this.proxy.getJson(Messages.Theaters.getTheaters, theaterIds)
    }

    deleteTheaters(theaterIds: string[]): Promise<DeleteTheatersResponse> {
        return this.proxy.getJson(Messages.Theaters.deleteTheaters, theaterIds)
    }

    searchTheatersPage(searchDto: SearchTheatersPageDto): Promise<PaginationResult<TheaterDto>> {
        return this.proxy.getJson(Messages.Theaters.searchTheatersPage, searchDto)
    }

    theatersExist(theaterIds: string[]): Promise<boolean> {
        return this.proxy.getJson(Messages.Theaters.theatersExist, theaterIds)
    }
}
