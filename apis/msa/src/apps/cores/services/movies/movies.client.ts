import { PaginationResult } from '@mannercode/common'
import { ClientProxyService, InjectClientProxy } from '@mannercode/microservices'
import { Injectable } from '@nestjs/common'
import { Messages } from 'config'
import { MovieDto, SearchMoviesPageDto } from './dtos'

@Injectable()
export class MoviesClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    allExist(movieIds: string[]): Promise<boolean> {
        return this.proxy.request(Messages.Movies.allExist, movieIds)
    }

    getMany(movieIds: string[]): Promise<MovieDto[]> {
        return this.proxy.request(Messages.Movies.getMany, movieIds)
    }

    searchPage(searchDto: SearchMoviesPageDto): Promise<PaginationResult<MovieDto>> {
        return this.proxy.request(Messages.Movies.searchPage, searchDto)
    }
}
