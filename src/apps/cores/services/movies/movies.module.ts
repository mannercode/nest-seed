import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { StorageFilesClient } from 'apps/infrastructures'
import { MongooseConfigModule } from 'shared'
import { Movie, MovieDraft, MovieDraftSchema, MovieSchema } from './models'
import { MoviesController } from './movies.controller'
import { MoviesRepository } from './movies.repository'
import { MoviesService } from './movies.service'
import { MovieDraftsRepository } from './movie-drafts.repository'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Movie.name, schema: MovieSchema }],
            MongooseConfigModule.connectionName
        ),
        MongooseModule.forFeature(
            [{ name: MovieDraft.name, schema: MovieDraftSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [MoviesService, MoviesRepository, MovieDraftsRepository, StorageFilesClient],
    controllers: [MoviesController]
})
export class MoviesModule {}
