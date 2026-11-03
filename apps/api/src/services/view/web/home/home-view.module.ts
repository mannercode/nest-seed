import { Module } from '@nestjs/common'
import { RecommendationModule } from '#application'
import { MoviesModule, ShowtimesModule, TheatersModule } from '#core'
import { WebHomeViewService } from './home-view.service.js'

@Module({
    exports: [WebHomeViewService],
    imports: [MoviesModule, ShowtimesModule, TheatersModule, RecommendationModule],
    providers: [WebHomeViewService]
})
export class WebHomeViewModule {}
