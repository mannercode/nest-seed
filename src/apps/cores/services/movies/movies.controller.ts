import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreateMovieAndFilesDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'
import { MoviesService } from './movies.service'

@Controller()
export class MoviesController {
    constructor(private service: MoviesService) {}

    @MessagePattern(Messages.Movies.createMovie)
    createMovie(@Payload() { createMovieDto, createFileDtos }: CreateMovieAndFilesDto) {
        return this.service.createMovie(createMovieDto, createFileDtos)
    }

    @MessagePattern(Messages.Movies.updateMovie)
    updateMovie(
        @Payload('movieId') movieId: string,
        @Payload('updateDto') updateDto: UpdateMovieDto
    ) {
        return this.service.updateMovie(movieId, updateDto)
    }

    @MessagePattern(Messages.Movies.getMovies)
    getMovies(@Payload() movieIds: string[]) {
        return this.service.getMovies(movieIds)
    }

    @MessagePattern(Messages.Movies.deleteMovies)
    deleteMovies(@Payload() movieIds: string[]) {
        return this.service.deleteMovies(movieIds)
    }

    @MessagePattern(Messages.Movies.searchMoviesPage)
    searchMoviesPage(@Payload() searchDto: SearchMoviesPageDto) {
        return this.service.searchMoviesPage(searchDto)
    }

    @MessagePattern(Messages.Movies.moviesExist)
    moviesExist(@Payload() movieIds: string[]) {
        return this.service.moviesExist(movieIds)
    }
}
