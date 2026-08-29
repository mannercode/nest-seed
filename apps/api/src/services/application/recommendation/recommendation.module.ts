import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule, WatchRecordsModule } from '#core'
import { RecommendationService } from './recommendation.service.js'

@Module({
    exports: [RecommendationService],
    imports: [ShowtimesModule, MoviesModule, WatchRecordsModule],
    providers: [RecommendationService]
})
export class RecommendationModule {}
