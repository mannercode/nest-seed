import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule, TheatersModule } from 'core'
import { UserHomeViewService } from './home-view.service'

@Module({
    exports: [UserHomeViewService],
    imports: [MoviesModule, ShowtimesModule, TheatersModule],
    providers: [UserHomeViewService]
})
export class UserHomeViewModule {}
