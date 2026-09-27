import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule } from '#core'
import { MovieDeletionService } from './movie-deletion.service.js'

@Module({
    exports: [MovieDeletionService],
    imports: [MoviesModule, ShowtimesModule],
    providers: [MovieDeletionService]
})
export class MovieDeletionModule {}
