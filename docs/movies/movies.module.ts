import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AssetsClient } from 'apps/infrastructures'
import { MongooseConfigModule } from 'shared'
import { Movie, MovieAssetsOutbox, MovieAssetsOutboxSchema, MovieSchema } from './models'
import { MovieAssetsOutboxRepository } from './movie-assets-outbox.repository'
import { MovieAssetsOutboxService } from './movie-assets-outbox.service'
import { MoviesController } from './movies.controller'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [
                { name: Movie.name, schema: MovieSchema },
                { name: MovieAssetsOutbox.name, schema: MovieAssetsOutboxSchema }
            ],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [
        MoviesService,
        MoviesRepository,
        MovieAssetsOutboxRepository,
        MovieAssetsOutboxService,
        AssetsClient
    ],
    controllers: [MoviesController]
})
export class MoviesModule {}
