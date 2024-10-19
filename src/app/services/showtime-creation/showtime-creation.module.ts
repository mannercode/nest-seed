import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { ServerSentEventsService } from 'common'
import { MoviesModule } from 'services/movies'
import { ShowtimesModule } from 'services/showtimes'
import { TheatersModule } from 'services/theaters'
import { TicketsModule } from 'services/tickets'
import {
    ShowtimeCreationEventsService,
    ShowtimeCreationProcessorService,
    ShowtimeCreationValidatorService
} from './services'
import { ShowtimeCreationService } from './showtime-creation.service'

@Module({
    imports: [
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        BullModule.registerQueue({ name: 'showtime-creation' })
    ],
    providers: [
        ShowtimeCreationService,
        ServerSentEventsService,
        ShowtimeCreationEventsService,
        ShowtimeCreationProcessorService,
        ShowtimeCreationValidatorService
    ],
    exports: [ShowtimeCreationService]
})
export class ShowtimeCreationModule {}
