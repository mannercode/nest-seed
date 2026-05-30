import { Module } from '@nestjs/common'
import { RecommendationModule } from 'application'
import { MoviesModule, ShowtimesModule, TheatersModule } from 'core'
import { UserHomeViewService } from './home-view.service'

@Module({
    exports: [UserHomeViewService],
    imports: [MoviesModule, ShowtimesModule, TheatersModule, RecommendationModule],
    providers: [UserHomeViewService]
})
export class UserHomeViewModule {}
