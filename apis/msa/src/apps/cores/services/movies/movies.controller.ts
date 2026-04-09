import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'config'
import { SearchMoviesPageDto } from './dtos'
import { MoviesService } from './movies.service'

@Controller()
export class MoviesController {
    constructor(private readonly service: MoviesService) {}

    @MessagePattern(Messages.Movies.allExist)
    allExist(@Payload() movieIds: string[]) {
        return this.service.allExist(movieIds)
    }

    @MessagePattern(Messages.Movies.getMany)
    getMany(@Payload() movieIds: string[]) {
        return this.service.getMany(movieIds)
    }

    @MessagePattern(Messages.Movies.searchPage)
    searchPage(@Payload() searchDto: SearchMoviesPageDto) {
        return this.service.searchPage(searchDto)
    }
}
