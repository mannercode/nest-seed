import { Module } from '@nestjs/common'
import { MoviesClient, ShowtimesClient, TheatersClient, TicketsClient } from 'cores'
import { ShowtimeBulkCreatorService, ShowtimeBulkValidatorService } from './services'
import { ShowtimeCreationClient } from './showtime-creation.client'
import { ShowtimeCreationController } from './showtime-creation.controller'
import { ShowtimeCreationEvents } from './showtime-creation.events'
import { ShowtimeCreationHttpController } from './showtime-creation.http-controller'
import { ShowtimeCreationService } from './showtime-creation.service'

@Module({
    controllers: [ShowtimeCreationController, ShowtimeCreationHttpController],
    providers: [
        MoviesClient,
        TheatersClient,
        ShowtimesClient,
        TicketsClient,
        ShowtimeCreationClient,
        ShowtimeCreationEvents,
        ShowtimeCreationService,
        ShowtimeBulkValidatorService,
        ShowtimeBulkCreatorService
    ],
    exports: [
        ShowtimeBulkValidatorService,
        ShowtimeBulkCreatorService,
        ShowtimeCreationEvents,
        ShowtimesClient,
        TicketsClient
    ]
})
export class ShowtimeCreationModule {}
