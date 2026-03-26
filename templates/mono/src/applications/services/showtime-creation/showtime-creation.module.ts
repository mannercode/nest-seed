import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'cores'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationWorkerService
} from './services'
import { ShowtimeCreationEvents } from './showtime-creation.events'
import { ShowtimeCreationService } from './showtime-creation.service'

@Module({
    exports: [ShowtimeCreationService],
    imports: [
        BullModule.registerQueue({ configKey: 'queue', name: 'showtime-creation' }),
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule
    ],
    providers: [
        ShowtimeCreationEvents,
        ShowtimeCreationService,
        ShowtimeCreationWorkerService,
        ShowtimeBulkValidatorService,
        ShowtimeBulkCreatorService
    ]
})
export class ShowtimeCreationModule {}
