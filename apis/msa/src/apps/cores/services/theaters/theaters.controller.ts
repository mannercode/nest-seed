import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'config'
import { SearchTheatersPageDto } from './dtos'
import { TheatersService } from './theaters.service'

@Controller()
export class TheatersController {
    constructor(private readonly service: TheatersService) {}

    @MessagePattern(Messages.Theaters.allExist)
    allExist(@Payload() theaterIds: string[]) {
        return this.service.allExist(theaterIds)
    }

    @MessagePattern(Messages.Theaters.getMany)
    getMany(@Payload() theaterIds: string[]) {
        return this.service.getMany(theaterIds)
    }

    @MessagePattern(Messages.Theaters.searchPage)
    searchPage(@Payload() searchDto: SearchTheatersPageDto) {
        return this.service.searchPage(searchDto)
    }
}
