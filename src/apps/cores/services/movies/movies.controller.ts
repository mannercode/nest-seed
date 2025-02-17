import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared/config'
import { MovieCreateWithFilesDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { MoviesService } from './movies.service'

@Controller()
export class MoviesController {
    constructor(private service: MoviesService) {}

    @MessagePattern(Messages.Movies.createMovie)
    createMovie(@Payload() { movieCreateDto, fileCreateDtos }: MovieCreateWithFilesDto) {
        return this.service.createMovie(movieCreateDto, fileCreateDtos)
    }

    @MessagePattern(Messages.Movies.updateMovie)
    updateMovie(
        @Payload('movieId') movieId: string,
        @Payload('updateDto') updateDto: MovieUpdateDto
    ) {
        return this.service.updateMovie(movieId, updateDto)
    }

    @MessagePattern(Messages.Movies.getMovie)
    getMovie(@Payload() movieId: string) {
        return this.service.getMovie(movieId)
    }

    @MessagePattern(Messages.Movies.deleteMovie)
    deleteMovie(@Payload() movieId: string) {
        return this.service.deleteMovie(movieId)
    }

    @MessagePattern(Messages.Movies.findMovies)
    findMovies(@Payload() queryDto: MovieQueryDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern(Messages.Movies.getMoviesByIds)
    getMoviesByIds(@Payload() movieIds: string[]) {
        return this.service.getMoviesByIds(movieIds)
    }

    @MessagePattern(Messages.Movies.moviesExist)
    moviesExist(@Payload() movieIds: string[]) {
        return this.service.moviesExist(movieIds)
    }
}
