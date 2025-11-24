import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { StorageFilesClient } from 'apps/infrastructures'
import { MongooseConfigModule } from 'shared'
import { Movie, MovieSchema } from './models'
import { MoviesController } from './movies.controller'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Movie.name, schema: MovieSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [MoviesService, MoviesRepository, StorageFilesClient],
    controllers: [MoviesController]
})
export class MoviesModule {}
