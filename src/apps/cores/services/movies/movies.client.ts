import { Injectable } from '@nestjs/common'
import { AssetPresignedUploadDto, CreateAssetDto } from 'apps/infrastructures'
import { ClientProxyService, InjectClientProxy, PaginationResult } from 'common'
import { Messages } from 'shared'
import { UpsertMovieDto, MovieDto, SearchMoviesPageDto } from './dtos'

@Injectable()
export class MoviesClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(upsertDto: UpsertMovieDto): Promise<MovieDto> {
        return this.proxy.request(Messages.Movies.create, upsertDto)
    }

    publish(movieId: string) {
        return this.proxy.request(Messages.Movies.publish, { movieId })
    }

    update(movieId: string, upsertDto: UpsertMovieDto): Promise<MovieDto> {
        return this.proxy.request(Messages.Movies.update, { movieId, upsertDto })
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

    createAsset(movieId: string, createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        return this.proxy.request(Messages.Movies.Assets.create, { movieId, createDto })
    }

    deleteAsset(movieId: string, assetId: string): Promise<Record<string, never>> {
        return this.proxy.request(Messages.Movies.Assets.delete, { movieId, assetId })
    }

    completeAsset(movieId: string, assetId: string): Promise<Record<string, never>> {
        return this.proxy.request(Messages.Movies.Assets.complete, { movieId, assetId })
    }
}
