import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule, WatchRecordsModule } from 'services/core'
import { RecommendationService } from './recommendation.service'

@Module({
    imports: [ShowtimesModule, MoviesModule, WatchRecordsModule],
    providers: [RecommendationService],
    exports: [RecommendationService]
})
export class RecommendationModule {}
