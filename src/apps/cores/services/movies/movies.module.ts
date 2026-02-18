import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AssetsClient } from 'apps/infrastructures'
import { MongooseConfigModule } from 'shared'
import { Movie, MoviePendingAsset, MoviePendingAssetSchema, MovieSchema } from './models'
import { MoviePendingAssetsRepository } from './movie-pending-assets.repository'
import { MoviesController } from './movies.controller'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'

@Module({
    controllers: [MoviesController],
    imports: [
        MongooseModule.forFeature(
            [{ name: Movie.name, schema: MovieSchema }],
            MongooseConfigModule.connectionName
        ),
        MongooseModule.forFeature(
            [{ name: MoviePendingAsset.name, schema: MoviePendingAssetSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [MoviesService, MoviesRepository, MoviePendingAssetsRepository, AssetsClient]
})
export class MoviesModule {}
