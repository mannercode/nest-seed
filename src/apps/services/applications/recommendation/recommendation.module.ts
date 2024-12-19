import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule, WatchRecordsModule } from 'cores'
import { RecommendationController } from './recommendation.controller'
import { RecommendationService } from './recommendation.service'

@Module({
    imports: [ShowtimesModule, MoviesModule, WatchRecordsModule],
    providers: [RecommendationService],
    controllers: [RecommendationController],
    exports: [RecommendationService]
})
export class RecommendationModule {}
