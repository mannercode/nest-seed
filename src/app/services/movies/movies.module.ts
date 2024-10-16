import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'
import { Movie, MovieSchema } from './models'
import { StorageFilesModule } from 'services/storage-files'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Movie.name, schema: MovieSchema }]),
        StorageFilesModule
    ],
    providers: [MoviesService, MoviesRepository],
    exports: [MoviesService]
})
export class MoviesModule {}
