import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MoviesClient } from 'apps/cores'
import { AssetsClient } from 'apps/infrastructures'
import { MongooseConfigModule } from 'shared'
import { MovieDraftsClient } from './movie-drafts.client'
import { MovieDraftsController } from './movie-drafts.controller'
import { MovieDraftsRepository } from './movie-drafts.repository'
import { MovieDraftsService } from './movie-drafts.service'
import { MovieDraft, MovieDraftSchema } from './models/movie-draft'

@Module({
    imports: [
        MongooseConfigModule,
        MongooseModule.forFeature(
            [{ name: MovieDraft.name, schema: MovieDraftSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [
        MovieDraftsService,
        MovieDraftsRepository,
        MoviesClient,
        AssetsClient,
        MovieDraftsClient
    ],
    controllers: [MovieDraftsController],
    exports: [MovieDraftsClient]
})
export class MovieDraftsModule {}
