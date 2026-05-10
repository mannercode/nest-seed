import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from 'config'
import { AssetsModule } from 'infrastructure'
import { Movie, MoviePendingAsset, MoviePendingAssetSchema, MovieSchema } from './models'
import { MoviePendingAssetsRepository } from './movie-pending-assets.repository'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'

@Module({
    exports: [MoviesService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Movie.name, schema: MovieSchema }],
            MONGO_CONNECTION_NAME
        ),
        MongooseModule.forFeature(
            [{ name: MoviePendingAsset.name, schema: MoviePendingAssetSchema }],
            MONGO_CONNECTION_NAME
        ),
        AssetsModule
    ],
    providers: [MoviesService, MoviesRepository, MoviePendingAssetsRepository]
})
export class MoviesModule {}
