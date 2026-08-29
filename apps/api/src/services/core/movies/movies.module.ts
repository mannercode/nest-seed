import { Module } from '@nestjs/common'
import { AssetsModule } from '#infrastructure'
import { MoviePendingAssetsRepository } from './movie-pending-assets.repository.js'
import { MoviesRepository } from './movies.repository.js'
import { MoviesService } from './movies.service.js'

@Module({
    exports: [MoviesService],
    imports: [AssetsModule],
    providers: [MoviesService, MoviesRepository, MoviePendingAssetsRepository]
})
export class MoviesModule {}
