import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Type } from 'class-transformer'
import { IsArray, ValidateNested } from 'class-validator'
import { StorageFileCreateDto } from 'infrastructures'
import { MovieCreateDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { MoviesService } from './movies.service'

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

    @MessagePattern({ cmd: 'createMovie' })
    createMovie(@Payload() { movieCreateDto, fileCreateDtos }: CreateMovieDto) {
        return this.service.createMovie(movieCreateDto, fileCreateDtos)
    }

    @MessagePattern({ cmd: 'updateMovie' })
    updateMovie(
        @Payload('movieId') movieId: string,
        @Payload('updateDto') updateDto: MovieUpdateDto
    ) {
        return this.service.updateMovie(movieId, updateDto)
    }

    @MessagePattern({ cmd: 'getMovie' })
    getMovie(@Payload() movieId: string) {
        return this.service.getMovie(movieId)
    }

    @MessagePattern({ cmd: 'deleteMovie' })
    deleteMovie(@Payload() movieId: string) {
        return this.service.deleteMovie(movieId)
    }

    @MessagePattern({ cmd: 'findMovies' })
    findMovies(@Payload() queryDto: MovieQueryDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern({ cmd: 'getMoviesByIds' })
    getMoviesByIds(@Payload() movieIds: string[]) {
        return this.service.getMoviesByIds(movieIds)
    }

    @MessagePattern({ cmd: 'moviesExist' })
    moviesExist(@Payload() movieIds: string[]) {
        return this.service.moviesExist(movieIds)
    }
}
