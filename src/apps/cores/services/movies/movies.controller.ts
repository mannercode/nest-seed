import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { MovieCreateWithFilesDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { MoviesService } from './movies.service'

@Controller()
export class MoviesController {
    constructor(private service: MoviesService) {}

    @MessagePattern('cores.movies.createMovie')
    createMovie(@Payload() { movieCreateDto, fileCreateDtos }: MovieCreateWithFilesDto) {
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
