import { Module } from '@nestjs/common'
import { CustomerOptionalJwtAuthGuard } from 'cores'
import { RecommendationHttpController } from './recommendation.http-controller'
import { RecommendationModule } from './recommendation.module'

/**
 * Wraps `RecommendationHttpController` so it is only registered in the
 * production `applications` app. Tests that combine `RecommendationModule`
 * with cores' `MoviesModule` (e.g. recommendation integration tests) avoid a
 * route collision between `/movies/recommended` and `/movies/:movieId` by
 * importing `RecommendationModule` directly without this HTTP layer.
 */
@Module({
    imports: [RecommendationModule],
    controllers: [RecommendationHttpController],
    providers: [CustomerOptionalJwtAuthGuard]
})
export class RecommendationHttpModule {}
