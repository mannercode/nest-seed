import { Module } from '@nestjs/common'
import { RecommendationService } from './recommendation.service'

@Module({
    imports: [],
    providers: [RecommendationService],
    exports: [RecommendationService]
})
export class RecommendationModule {}
