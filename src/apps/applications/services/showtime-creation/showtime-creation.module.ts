import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MoviesProxy, ShowtimesProxy, TheatersProxy, TicketsProxy } from 'cores'
import {
    ShowtimeCreationEventsService,
    ShowtimeCreationValidatorService,
    ShowtimeCreationWorkerService
} from './services'
import { ShowtimeCreationController } from './showtime-creation.controller'
import { ShowtimeCreationService } from './showtime-creation.service'

@Module({
    imports: [BullModule.registerQueue({ configKey: 'queue', name: 'showtime-creation' })],
    providers: [
        MoviesProxy,
        TheatersProxy,
        ShowtimesProxy,
        TicketsProxy,
        ShowtimeCreationService,
        ShowtimeCreationEventsService,
        ShowtimeCreationWorkerService,
        ShowtimeCreationValidatorService
    ],
    controllers: [ShowtimeCreationController]
})
export class ShowtimeCreationModule {}
