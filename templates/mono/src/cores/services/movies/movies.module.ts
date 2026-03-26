import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'common'
import { AssetsModule } from 'infrastructures'
import { Movie, MoviePendingAsset, MoviePendingAssetSchema, MovieSchema } from './models'
import { MoviePendingAssetsRepository } from './movie-pending-assets.repository'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'

@Module({
    exports: [MoviesService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Movie.name, schema: MovieSchema }],
            MongooseConfigModule.connectionName
        ),
        MongooseModule.forFeature(
            [{ name: MoviePendingAsset.name, schema: MoviePendingAssetSchema }],
            MongooseConfigModule.connectionName
        ),
        AssetsModule
    ],
    providers: [MoviesService, MoviesRepository, MoviePendingAssetsRepository]
})
export class MoviesModule {}
