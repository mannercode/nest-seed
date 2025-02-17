import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { StorageFileCreateDto } from 'infrastructures'
import { Routes } from 'shared/config'
import { MovieCreateDto, MovieDto, MovieQueryDto, MovieUpdateDto } from './dtos'

@Injectable()
export class MoviesProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createMovie(
        movieCreateDto: MovieCreateDto,
        fileCreateDtos: StorageFileCreateDto[]
    ): Promise<MovieDto> {
        return getProxyValue(
            this.service.send(Routes.Messages.Movies.createMovie, { movieCreateDto, fileCreateDtos })
        )
    }

    @MethodLog({ level: 'verbose' })
    updateMovie(movieId: string, updateDto: MovieUpdateDto): Promise<MovieDto> {
        return getProxyValue(this.service.send(Routes.Messages.Movies.updateMovie, { movieId, updateDto }))
    }

    @MethodLog({ level: 'verbose' })
    getMovie(movieId: string): Promise<MovieDto> {
        return getProxyValue(this.service.send(Routes.Messages.Movies.getMovie, movieId))
    }

    @MethodLog({ level: 'verbose' })
    deleteMovie(movieId: string): Promise<boolean> {
        return getProxyValue(this.service.send(Routes.Messages.Movies.deleteMovie, movieId))
    }

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: MovieQueryDto): Promise<MovieDto[]> {
        return getProxyValue(this.service.send(Routes.Messages.Movies.findMovies, queryDto))
    }

    @MethodLog({ level: 'verbose' })
    getMoviesByIds(movieIds: string[]): Promise<MovieDto[]> {
        return getProxyValue(this.service.send(Routes.Messages.Movies.getMoviesByIds, movieIds))
    }

    @MethodLog({ level: 'verbose' })
    moviesExist(movieIds: string[]): Promise<boolean> {
        return getProxyValue(this.service.send(Routes.Messages.Movies.moviesExist, movieIds))
    }
}
