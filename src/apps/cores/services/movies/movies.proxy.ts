import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { StorageFileCreateDto } from 'infrastructures'
import { ClientProxyConfig, Messages } from 'shared/config'
import { MovieCreateDto, MovieDto, MovieQueryDto, MovieUpdateDto } from './dtos'

@Injectable()
export class MoviesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    createMovie(
        movieCreateDto: MovieCreateDto,
        fileCreateDtos: StorageFileCreateDto[]
    ): Promise<MovieDto> {
        return this.service.getJson(Messages.Movies.createMovie, { movieCreateDto, fileCreateDtos })
    }

    updateMovie(movieId: string, updateDto: MovieUpdateDto): Promise<MovieDto> {
        return this.service.getJson(Messages.Movies.updateMovie, { movieId, updateDto })
    }

    getMovie(movieId: string): Promise<MovieDto> {
        return this.service.getJson(Messages.Movies.getMovie, movieId)
    }

    deleteMovie(movieId: string): Promise<boolean> {
        return this.service.getJson(Messages.Movies.deleteMovie, movieId)
    }

    findMovies(queryDto: MovieQueryDto): Promise<MovieDto[]> {
        return this.service.getJson(Messages.Movies.findMovies, queryDto)
    }

    getMoviesByIds(movieIds: string[]): Promise<MovieDto[]> {
        return this.service.getJson(Messages.Movies.getMoviesByIds, movieIds)
    }

    moviesExist(movieIds: string[]): Promise<boolean> {
        return this.service.getJson(Messages.Movies.moviesExist, movieIds)
    }
}
