import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfig } from 'services/config'
import { StorageFilesModule } from 'services/infrastructures'
import { Movie, MovieSchema } from './models'
import { MoviesController } from './movies.controller'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Movie.name, schema: MovieSchema }],
            MongooseConfig.connName
        ),
        StorageFilesModule
    ],
    providers: [MoviesService, MoviesRepository],
    controllers: [MoviesController],
    exports: [MoviesService]
})
export class MoviesModule {}
