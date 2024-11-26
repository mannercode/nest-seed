import { Module } from '@nestjs/common'
import { MoviesModule } from 'services/movies'
import { ShowtimesModule } from 'services/showtimes'
import { WatchRecordsModule } from 'services/watch-records'
import { RecommendationService } from './recommendation.service'

@Module({
    imports: [ShowtimesModule, MoviesModule, WatchRecordsModule],
    providers: [RecommendationService],
    exports: [RecommendationService]
})
export class RecommendationModule {}
