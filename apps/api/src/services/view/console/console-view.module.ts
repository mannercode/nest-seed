import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule, TheatersModule } from 'core'
import { ConsoleViewService } from './console-view.service'

@Module({
    exports: [ConsoleViewService],
    imports: [MoviesModule, ShowtimesModule, TheatersModule],
    providers: [ConsoleViewService]
})
export class ConsoleViewModule {}
