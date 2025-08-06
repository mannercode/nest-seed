import { Injectable } from '@nestjs/common'
import { CreateStorageFileDto } from 'apps/infrastructures'
import { ClientProxyService, InjectClientProxy, PaginationResult } from 'common'
import { Messages } from 'shared'
import {
    CreateMovieDto,
    DeleteMoviesResponse,
    MovieDto,
    SearchMoviesPageDto,
    UpdateMovieDto
} from './dtos'

@Injectable()
export class MoviesClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    createMovie(
        createMovieDto: CreateMovieDto,
        createFileDtos: CreateStorageFileDto[]
    ): Promise<MovieDto> {
        return this.proxy.getJson(Messages.Movies.createMovie, { createMovieDto, createFileDtos })
    }

    updateMovie(movieId: string, updateDto: UpdateMovieDto): Promise<MovieDto> {
        return this.proxy.getJson(Messages.Movies.updateMovie, { movieId, updateDto })
    }

    getMovies(movieIds: string[]): Promise<MovieDto[]> {
        return this.proxy.getJson(Messages.Movies.getMovies, movieIds)
    }

    deleteMovies(movieIds: string[]): Promise<DeleteMoviesResponse> {
        return this.proxy.getJson(Messages.Movies.deleteMovies, movieIds)
    }

    searchMoviesPage(searchDto: SearchMoviesPageDto): Promise<PaginationResult<MovieDto>> {
        return this.proxy.getJson(Messages.Movies.searchMoviesPage, searchDto)
    }

    moviesExist(movieIds: string[]): Promise<boolean> {
        return this.proxy.getJson(Messages.Movies.moviesExist, movieIds)
    }
}
