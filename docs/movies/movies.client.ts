import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, PaginationResult } from 'common'
import { Messages } from 'shared'
import { CreateMovieDto, MovieDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'

@Injectable()
export class MoviesClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createMovieDto: CreateMovieDto): Promise<MovieDto> {
        return this.proxy.request(Messages.Movies.create, createMovieDto)
    }

    update(movieId: string, updateDto: UpdateMovieDto): Promise<MovieDto> {
        return this.proxy.request(Messages.Movies.update, { movieId, updateDto })
    }

    getMany(movieIds: string[]): Promise<MovieDto[]> {
        return this.proxy.request(Messages.Movies.getMany, movieIds)
    }

    deleteMany(movieIds: string[]): Promise<Record<string, never>> {
        return this.proxy.request(Messages.Movies.deleteMany, movieIds)
    }

    searchPage(searchDto: SearchMoviesPageDto): Promise<PaginationResult<MovieDto>> {
        return this.proxy.request(Messages.Movies.searchPage, searchDto)
    }

    allExist(movieIds: string[]): Promise<boolean> {
        return this.proxy.request(Messages.Movies.allExist, movieIds)
    }
}
