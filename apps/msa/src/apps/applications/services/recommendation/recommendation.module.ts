import { Module } from '@nestjs/common'
import { MoviesClient, ShowtimesClient, WatchRecordsClient } from 'cores'
import { RecommendationController } from './recommendation.controller'
import { RecommendationService } from './recommendation.service'

@Module({
    controllers: [RecommendationController],
    providers: [RecommendationService, ShowtimesClient, MoviesClient, WatchRecordsClient],
    exports: [RecommendationService]
})
export class RecommendationModule {}
