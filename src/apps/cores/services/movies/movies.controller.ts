import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Subjects } from 'shared/config'
import { MovieCreateWithFilesDto, MovieQueryDto, MovieUpdateDto } from './dtos'
import { MoviesService } from './movies.service'

@Controller()
export class MoviesController {
    constructor(private service: MoviesService) {}

    @MessagePattern(Subjects.Movies.createMovie)
    createMovie(@Payload() { movieCreateDto, fileCreateDtos }: MovieCreateWithFilesDto) {
        return this.service.createMovie(movieCreateDto, fileCreateDtos)
    }

    @MessagePattern(Subjects.Movies.updateMovie)
    updateMovie(
        @Payload('movieId') movieId: string,
        @Payload('updateDto') updateDto: MovieUpdateDto
    ) {
        return this.service.updateMovie(movieId, updateDto)
    }

    @MessagePattern(Subjects.Movies.getMovie)
    getMovie(@Payload() movieId: string) {
        return this.service.getMovie(movieId)
    }

    @MessagePattern(Subjects.Movies.deleteMovie)
    deleteMovie(@Payload() movieId: string) {
        return this.service.deleteMovie(movieId)
    }

    @MessagePattern(Subjects.Movies.findMovies)
    findMovies(@Payload() queryDto: MovieQueryDto) {
        return this.service.findMovies(queryDto)
    }

    @MessagePattern(Subjects.Movies.getMoviesByIds)
    getMoviesByIds(@Payload() movieIds: string[]) {
        return this.service.getMoviesByIds(movieIds)
    }

    @MessagePattern(Subjects.Movies.moviesExist)
    moviesExist(@Payload() movieIds: string[]) {
        return this.service.moviesExist(movieIds)
    }
}
