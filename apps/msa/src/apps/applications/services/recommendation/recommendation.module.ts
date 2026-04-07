import { Module } from '@nestjs/common'
import { MoviesClient, ShowtimesClient, WatchRecordsClient } from 'cores'
import { RecommendationService } from './recommendation.service'

@Module({
    providers: [RecommendationService, ShowtimesClient, MoviesClient, WatchRecordsClient],
    exports: [RecommendationService]
})
export class RecommendationModule {}
