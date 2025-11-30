import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreateTheaterDto, SearchTheatersPageDto, UpdateTheaterDto } from './dtos'
import { TheatersService } from './theaters.service'

@Controller()
export class TheatersController {
    constructor(private readonly service: TheatersService) {}

    @MessagePattern(Messages.Theaters.create)
    create(@Payload() createDto: CreateTheaterDto) {
        return this.service.create(createDto)
    }

    @MessagePattern(Messages.Theaters.update)
    update(
        @Payload('theaterId') theaterId: string,
        @Payload('updateDto') updateDto: UpdateTheaterDto
    ) {
        return this.service.update(theaterId, updateDto)
    }

    @MessagePattern(Messages.Theaters.getMany)
    getMany(@Payload() theaterIds: string[]) {
        return this.service.getMany(theaterIds)
    }

    @MessagePattern(Messages.Theaters.deleteMany)
    deleteMany(@Payload() theaterIds: string[]) {
        return this.service.deleteMany(theaterIds)
    }

    @MessagePattern(Messages.Theaters.searchPage)
    searchPage(@Payload() searchDto: SearchTheatersPageDto) {
        return this.service.searchPage(searchDto)
    }

    @MessagePattern(Messages.Theaters.allExist)
    exists(@Payload() theaterIds: string[]) {
        return this.service.allExist(theaterIds)
    }
}
