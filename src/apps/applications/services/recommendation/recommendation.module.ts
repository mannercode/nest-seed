import { Module } from '@nestjs/common'
import { MoviesProxy, ShowtimesProxy, WatchRecordsProxy } from 'cores'
import { RecommendationController } from './recommendation.controller'
import { RecommendationService } from './recommendation.service'

@Module({
    providers: [RecommendationService, ShowtimesProxy, MoviesProxy, WatchRecordsProxy],
    controllers: [RecommendationController],
    exports: [RecommendationService]
})
export class RecommendationModule {}
