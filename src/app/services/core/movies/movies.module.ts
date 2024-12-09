import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { StorageFilesModule } from 'services/infra'
import { Movie, MovieSchema } from './models'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Movie.name, schema: MovieSchema }], 'mongo'),
        StorageFilesModule
    ],
    providers: [MoviesService, MoviesRepository],
    exports: [MoviesService]
})
export class MoviesModule {}
