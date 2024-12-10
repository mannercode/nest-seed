import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ServerSentEventsService } from 'common'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'services/cores'
import {
    ShowtimeCreationEventsService,
    ShowtimeCreationValidatorService,
    ShowtimeCreationWorkerService
} from './services'
import { ShowtimeCreationService } from './showtime-creation.service'

@Module({
    imports: [
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        BullModule.registerQueue({ configKey: 'queue', name: 'showtime-creation' })
    ],
    providers: [
        ShowtimeCreationService,
        ServerSentEventsService,
        ShowtimeCreationEventsService,
        ShowtimeCreationWorkerService,
        ShowtimeCreationValidatorService
    ],
    exports: [ShowtimeCreationService]
})
export class ShowtimeCreationModule {}
