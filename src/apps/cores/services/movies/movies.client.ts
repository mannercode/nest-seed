import { Injectable } from '@nestjs/common'
import { CreateStorageFileDto } from 'apps/infrastructures'
import { ClientProxyService, InjectClientProxy, PaginationResult } from 'common'
import { Messages } from 'shared'
import {
    CreateMovieDto,
    DeleteMoviesResponse,
    FinalizeMovieAssetDto,
    FinalizeMovieDraftDto,
    MovieDto,
    PresignMovieAssetDto,
    SearchMoviesPageDto,
    UpdateMovieDto
} from './dtos'

@Injectable()
export class MoviesClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    presignMovieAsset(draftId: string, presignDto: PresignMovieAssetDto) {
        return this.proxy.getJson(Messages.Movies.presignMovieAsset, { draftId, presignDto })
    }

    finalizeMovieAsset(draftId: string, finalizeDto: FinalizeMovieAssetDto) {
        return this.proxy.getJson(Messages.Movies.finalizeMovieAsset, { draftId, finalizeDto })
    }

    finalizeMovieDraft(draftId: string, finalizeDto: FinalizeMovieDraftDto) {
        return this.proxy.getJson(Messages.Movies.finalizeMovieDraft, { draftId, finalizeDto })
    }

    createMovieDraft() {
        return this.proxy.getJson(Messages.Movies.createMovieDraft, {})
    }

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
