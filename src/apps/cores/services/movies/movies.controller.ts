import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Type } from 'class-transformer'
import { IsArray, ValidateNested } from 'class-validator'

import { StorageFileCreateDto } from 'infrastructures'
import { MovieCreateDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { MoviesService } from './movies.service'

// TODO 이름 검토하고 위치 이동하라
class CreateMovieDto {
    @ValidateNested({})
    @Type(() => MovieCreateDto)
    movieCreateDto: MovieCreateDto

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StorageFileCreateDto)
    fileCreateDtos: StorageFileCreateDto[]
}

@Controller()
export class MoviesController {
    constructor(private service: MoviesService) {}

    @MessagePattern('cores.movies.createMovie')
    createMovie(@Payload() { movieCreateDto, fileCreateDtos }: CreateMovieDto) {
        return this.service.createMovie(movieCreateDto, fileCreateDtos)
    }

    @MessagePattern('cores.movies.updateMovie')
    updateMovie(
        @Payload('movieId') movieId: string,
        @Payload('updateDto') updateDto: MovieUpdateDto
    ) {
        return this.service.updateMovie(movieId, updateDto)
    }

    @MessagePattern('cores.movies.getMovie')
    getMovie(@Payload() movieId: string) {
        return this.service.getMovie(movieId)
    }

    @MessagePattern('cores.movies.deleteMovie')
    deleteMovie(@Payload() movieId: string) {
        return this.service.deleteMovie(movieId)
    }

    @MessagePattern('cores.movies.findMovies')
    findMovies(@Payload() queryDto: MovieQueryDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern('cores.movies.getMoviesByIds')
    getMoviesByIds(@Payload() movieIds: string[]) {
        return this.service.getMoviesByIds(movieIds)
    }

    @MessagePattern('cores.movies.moviesExist')
    moviesExist(@Payload() movieIds: string[]) {
        return this.service.moviesExist(movieIds)
    }
}
