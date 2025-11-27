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

    create(createMovieDto: CreateMovieDto): Promise<MovieDto> {
        return this.proxy.getJson(Messages.Movies.create, createMovieDto)
    }

    update(movieId: string, updateDto: UpdateMovieDto): Promise<MovieDto> {
        return this.proxy.getJson(Messages.Movies.update, { movieId, updateDto })
    }

    getMany(movieIds: string[]): Promise<MovieDto[]> {
        return this.proxy.getJson(Messages.Movies.getMany, movieIds)
    }

    deleteMany(movieIds: string[]): Promise<DeleteMoviesResponse> {
        return this.proxy.getJson(Messages.Movies.deleteMany, movieIds)
    }

    searchPage(searchDto: SearchMoviesPageDto): Promise<PaginationResult<MovieDto>> {
        return this.proxy.getJson(Messages.Movies.searchPage, searchDto)
    }

    allExistByIds(movieIds: string[]): Promise<boolean> {
        return this.proxy.getJson(Messages.Movies.allExist, movieIds)
    }
}
