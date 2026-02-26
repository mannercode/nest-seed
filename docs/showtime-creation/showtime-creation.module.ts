import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MoviesClient, ShowtimesClient, TheatersClient, TicketsClient } from 'apps/cores'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationWorkerService
} from './services'
import { ShowtimeCreationClient } from './showtime-creation.client'
import { ShowtimeCreationController } from './showtime-creation.controller'
import { ShowtimeCreationEvents } from './showtime-creation.events'
import { ShowtimeCreationService } from './showtime-creation.service'

@Module({
    controllers: [ShowtimeCreationController],
    imports: [BullModule.registerQueue({ configKey: 'queue', name: 'showtime-creation' })],
    providers: [
        MoviesClient,
        TheatersClient,
        ShowtimesClient,
        TicketsClient,
        ShowtimeCreationClient,
        ShowtimeCreationEvents,
        ShowtimeCreationService,
        ShowtimeCreationWorkerService,
        ShowtimeBulkValidatorService,
        ShowtimeBulkCreatorService
    ]
})
export class ShowtimeCreationModule {}
