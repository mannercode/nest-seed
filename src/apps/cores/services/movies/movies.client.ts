import { Injectable } from '@nestjs/common'
import { AssetPresignedUploadDto, CreateAssetDto } from 'apps/infrastructures'
import { ClientProxyService, PaginationResult } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { MovieDto, SearchMoviesPageDto, UpsertMovieDto } from './dtos'

@Injectable()
export class MoviesClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(upsertDto: UpsertMovieDto): Promise<MovieDto> {
        return this.proxy.request(Messages.Movies.create, upsertDto)
    }

    createAsset(movieId: string, createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        return this.proxy.request(Messages.Movies.Assets.create, { createDto, movieId })
    }

    async deleteAsset(movieId: string, assetId: string): Promise<void> {
        await this.proxy.request(Messages.Movies.Assets.delete, { assetId, movieId })
    }

    async deleteMany(movieIds: string[]): Promise<void> {
        await this.proxy.request(Messages.Movies.deleteMany, movieIds)
    }

    allExist(movieIds: string[]): Promise<boolean> {
        return this.proxy.request(Messages.Movies.allExist, movieIds)
    }

    async finalizeUpload(movieId: string, assetId: string): Promise<void> {
        await this.proxy.request(Messages.Movies.Assets.finalizeUpload, { assetId, movieId })
    }

    getMany(movieIds: string[]): Promise<MovieDto[]> {
        return this.proxy.request(Messages.Movies.getMany, movieIds)
    }

    publish(movieId: string) {
        return this.proxy.request(Messages.Movies.publish, { movieId })
    }

    searchPage(searchDto: SearchMoviesPageDto): Promise<PaginationResult<MovieDto>> {
        return this.proxy.request(Messages.Movies.searchPage, searchDto)
    }

    update(movieId: string, upsertDto: UpsertMovieDto): Promise<MovieDto> {
        return this.proxy.request(Messages.Movies.update, { movieId, upsertDto })
    }
}
