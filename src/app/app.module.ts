import { Module } from '@nestjs/common'
import { CustomersModule } from 'services/customers'
import { MoviesModule } from 'services/movies'
import { ShowtimeCreationModule } from 'services/showtime-creation'
import { ShowtimesModule } from 'services/showtimes'
import { StorageFilesModule } from 'services/storage-files'
import { TheatersModule } from 'services/theaters'
import { TicketHoldingModule } from 'services/ticket-holding'
import { TicketsModule } from 'services/tickets'
import {
    CustomersController,
    MoviesController,
    ShowtimeCreationController,
    StorageFilesController,
    TheatersController
} from './controllers'
import { CustomerJwtStrategy, CustomerLocalStrategy } from './controllers/guards'
import { CoreModule } from './core'

@Module({
    imports: [
        CoreModule,
        CustomersModule,
        StorageFilesModule,
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        ShowtimeCreationModule,
        TicketHoldingModule
    ],
    providers: [CustomerLocalStrategy, CustomerJwtStrategy],
    controllers: [
        CustomersController,
        StorageFilesController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController
    ]
})
export class AppModule {}
