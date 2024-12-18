import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import {
    MovieCreateDto,
    MovieDto,
    MovieQueryDto,
    MovieUpdateDto,
    StorageFileCreateDto
} from 'types'

@Injectable()
export class MoviesService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createMovie(
        movieCreateDto: MovieCreateDto,
        fileCreateDtos: StorageFileCreateDto[]
    ): Promise<MovieDto> {
        return getProxyValue(this.service.send('createMovie', { movieCreateDto, fileCreateDtos }))
    }

    @MethodLog({ level: 'verbose' })
    updateMovie(movieId: string, updateDto: MovieUpdateDto): Promise<MovieDto> {
        return getProxyValue(this.service.send('updateMovie', { movieId, updateDto }))
    }

    @MethodLog({ level: 'verbose' })
    getMovie(movieId: string): Promise<MovieDto> {
        return getProxyValue(this.service.send('getMovie', movieId))
    }

    @MethodLog({ level: 'verbose' })
    deleteMovie(movieId: string): Promise<boolean> {
        return getProxyValue(this.service.send('deleteMovie', movieId))
    }

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: MovieQueryDto): Promise<MovieDto[]> {
        return getProxyValue(this.service.send('findMovies', queryDto))
    }

    @MethodLog({ level: 'verbose' })
    getMoviesByIds(movieIds: string[]): Promise<MovieDto[]> {
        return getProxyValue(this.service.send('getMoviesByIds', movieIds))
    }

    @MethodLog({ level: 'verbose' })
    moviesExist(movieIds: string[]): Promise<boolean> {
        return getProxyValue(this.service.send('moviesExist', movieIds))
    }
}
