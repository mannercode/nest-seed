import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import {
    MovieCreateDto,
    MovieDto,
    MovieQueryDto,
    MovieUpdateDto,
    StorageFileCreateDto
} from 'types'

@Injectable()
export class MoviesService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createMovie(
        movieCreateDto: MovieCreateDto,
        fileCreateDtos: StorageFileCreateDto[]
    ): Observable<MovieDto> {
        return this.service.send('createMovie', { movieCreateDto, fileCreateDtos })
    }

    @MethodLog({ level: 'verbose' })
    updateMovie(movieId: string, updateDto: MovieUpdateDto): Observable<MovieDto> {
        return this.service.send('updateMovie', { movieId, updateDto })
    }

    @MethodLog({ level: 'verbose' })
    getMovie(movieId: string): Observable<MovieDto> {
        return this.service.send('getMovie', movieId)
    }

    @MethodLog({ level: 'verbose' })
    deleteMovie(movieId: string): Observable<boolean> {
        return this.service.send('deleteMovie', movieId)
    }

    @MethodLog({ level: 'verbose' })
    findMovies(queryDto: MovieQueryDto): Observable<MovieDto[]> {
        return this.service.send('findMovies', queryDto)
    }

    @MethodLog({ level: 'verbose' })
    getMoviesByIds(movieIds: string[]): Observable<MovieDto[]> {
        return this.service.send('getMoviesByIds', movieIds)
    }

    @MethodLog({ level: 'verbose' })
    moviesExist(movieIds: string[]): Observable<boolean> {
        return this.service.send('moviesExist', movieIds)
    }
}
