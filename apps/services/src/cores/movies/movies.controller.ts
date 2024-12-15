import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { MovieCreateDto, MovieQueryDto, MovieUpdateDto, StorageFileCreateDto } from 'types'
import { MoviesService } from './movies.service'

@Injectable()
export class MoviesController {
    constructor(private service: MoviesService) {}

    @MessagePattern({ cmd: 'createMovie' })
    async createMovie(
        @Payload('movieCreateDto') movieCreateDto: MovieCreateDto,
        @Payload('fileCreateDtos') fileCreateDtos: StorageFileCreateDto[]
    ) {
        return this.service.createMovie(movieCreateDto, fileCreateDtos)
    }

    @MessagePattern({ cmd: 'updateMovie' })
    async updateMovie(
        @Payload('movieId') movieId: string,
        @Payload('updateDto') updateDto: MovieUpdateDto
    ) {
        return this.service.updateMovie(movieId, updateDto)
    }

    @MessagePattern({ cmd: 'getMovie' })
    async getMovie(@Payload() movieId: string) {
        return this.service.getMovie(movieId)
    }

    @MessagePattern({ cmd: 'deleteMovie' })
    async deleteMovie(@Payload() movieId: string) {
        return this.service.deleteMovie(movieId)
    }

    @MessagePattern({ cmd: 'findMovies' })
    async findMovies(@Payload() queryDto: MovieQueryDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern({ cmd: 'getMoviesByIds' })
    async getMoviesByIds(@Payload() movieIds: string[]) {
        return this.service.getMoviesByIds(movieIds)
    }

    @MessagePattern({ cmd: 'moviesExist' })
    async moviesExist(@Payload() movieIds: string[]) {
        return this.service.moviesExist(movieIds)
    }
}
