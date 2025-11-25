import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreateMovieAndFilesDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'
import { MoviesService } from './movies.service'

@Controller()
export class MoviesController {
    constructor(private service: MoviesService) {}

    @MessagePattern(Messages.Movies.create)
    create(@Payload() { createMovieDto, createFileDtos }: CreateMovieAndFilesDto) {
        return this.service.create(createMovieDto, createFileDtos)
    }

    @MessagePattern(Messages.Movies.update)
    update(@Payload('movieId') movieId: string, @Payload('updateDto') updateDto: UpdateMovieDto) {
        return this.service.update(movieId, updateDto)
    }

    @MessagePattern(Messages.Movies.getMany)
    getMany(@Payload() movieIds: string[]) {
        return this.service.getMany(movieIds)
    }

    @MessagePattern(Messages.Movies.deleteMany)
    deleteMany(@Payload() movieIds: string[]) {
        return this.service.deleteMany(movieIds)
    }

    @MessagePattern(Messages.Movies.searchPage)
    searchPage(@Payload() searchDto: SearchMoviesPageDto) {
        return this.service.searchPage(searchDto)
    }

    @MessagePattern(Messages.Movies.allExist)
    exists(@Payload() movieIds: string[]) {
        return this.service.allExist(movieIds)
    }
}
