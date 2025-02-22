import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { StorageFileCreateDto } from 'infrastructures'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { MovieCreateDto, MovieDto, MovieQueryDto, MovieUpdateDto } from './dtos'

@Injectable()
export class MoviesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createMovie(
        movieCreateDto: MovieCreateDto,
        fileCreateDtos: StorageFileCreateDto[]
    ): Promise<MovieDto> {
        return getProxyValue(
            this.service.send(Subjects.Movies.createMovie, { movieCreateDto, fileCreateDtos })
        )
    }

    @MethodLog({ level: 'verbose' })
    updateMovie(movieId: string, updateDto: MovieUpdateDto): Promise<MovieDto> {
        return getProxyValue(this.service.send(Subjects.Movies.updateMovie, { movieId, updateDto }))
    }

    @MethodLog({ level: 'verbose' })
    getMovie(movieId: string): Promise<MovieDto> {
        return getProxyValue(this.service.send(Subjects.Movies.getMovie, movieId))
    }

    @MethodLog({ level: 'verbose' })
    deleteMovie(movieId: string): Promise<boolean> {
        return getProxyValue(this.service.send(Subjects.Movies.deleteMovie, movieId))
    }

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: MovieQueryDto): Promise<MovieDto[]> {
        return getProxyValue(this.service.send(Subjects.Movies.findMovies, queryDto))
    }

    @MethodLog({ level: 'verbose' })
    getMoviesByIds(movieIds: string[]): Promise<MovieDto[]> {
        return getProxyValue(this.service.send(Subjects.Movies.getMoviesByIds, movieIds))
    }

    @MethodLog({ level: 'verbose' })
    moviesExist(movieIds: string[]): Promise<boolean> {
        return getProxyValue(this.service.send(Subjects.Movies.moviesExist, movieIds))
    }
}
