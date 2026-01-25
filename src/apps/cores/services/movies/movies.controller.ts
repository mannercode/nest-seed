import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { CreateAssetDto } from 'apps/infrastructures'
import { Messages } from 'shared'
import { SearchMoviesPageDto, UpsertMovieDto } from './dtos'
import { MoviesService } from './movies.service'

@Controller()
export class MoviesController {
    constructor(private readonly service: MoviesService) {}

    @MessagePattern(Messages.Movies.create)
    create(@Payload() upsertDto: UpsertMovieDto) {
        return this.service.create(upsertDto)
    }

    @MessagePattern(Messages.Movies.publish)
    publish(@Payload('movieId') movieId: string) {
        return this.service.publish(movieId)
    }

    @MessagePattern(Messages.Movies.update)
    update(@Payload('movieId') movieId: string, @Payload('upsertDto') upsertDto: UpsertMovieDto) {
        return this.service.update(movieId, upsertDto)
    }

    @MessagePattern(Messages.Movies.getMany)
    getMany(@Payload() movieIds: string[]) {
        return this.service.getMany(movieIds)
    }

    @MessagePattern(Messages.Movies.deleteMany)
    deleteMany(@Payload() movieIds: string[]) {
        return this.service.deleteMany(movieIds)
    }

    @MessagePattern(Messages.Movies.searchPage)
    searchPage(@Payload() searchDto: SearchMoviesPageDto) {
        return this.service.searchPage(searchDto)
    }

    @MessagePattern(Messages.Movies.allExist)
    allExist(@Payload() movieIds: string[]) {
        return this.service.allExist(movieIds)
    }

    @MessagePattern(Messages.Movies.Assets.create)
    createAsset(
        @Payload('movieId') movieId: string,
        @Payload('createDto') createDto: CreateAssetDto
    ) {
        return this.service.createAsset(movieId, createDto)
    }

    @MessagePattern(Messages.Movies.Assets.delete)
    deleteAsset(@Payload('movieId') movieId: string, @Payload('assetId') assetId: string) {
        return this.service.deleteAsset(movieId, assetId)
    }

    @MessagePattern(Messages.Movies.Assets.complete)
    completeAsset(@Payload('movieId') movieId: string, @Payload('assetId') assetId: string) {
        return this.service.completeAsset(movieId, assetId)
    }
}
