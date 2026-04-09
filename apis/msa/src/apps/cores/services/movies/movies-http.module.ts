import { Module } from '@nestjs/common'
import { MoviesHttpController } from './movies.http-controller'
import { MoviesModule } from './movies.module'

/**
 * Wraps `MoviesHttpController` so it is only registered in the production
 * `cores` app. Tests that combine `MoviesModule` with other modules (notably
 * `RecommendationModule`, which exposes `/movies/recommended`) avoid a route
 * collision by importing `MoviesModule` directly without this HTTP layer.
 */
@Module({ imports: [MoviesModule], controllers: [MoviesHttpController] })
export class MoviesHttpModule {}
