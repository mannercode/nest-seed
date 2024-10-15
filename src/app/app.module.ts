import { Module } from '@nestjs/common'
import { CustomersModule } from 'services/customers'
import { MoviesModule } from 'services/movies'
import { ShowtimesModule } from 'services/showtimes'
import { StorageFilesModule } from 'services/storage-files'
import { TheatersModule } from 'services/theaters'
import {
    CustomersController,
    MoviesController,
    StorageFilesController,
    TheatersController
} from './controllers'
import { CustomerJwtStrategy, CustomerLocalStrategy } from './controllers/guards'
import { CoreModule } from './core'
import { TicketsModule } from 'services/tickets'

@Module({
    imports: [
        CoreModule,
        CustomersModule,
        StorageFilesModule,
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule
    ],
    providers: [CustomerLocalStrategy, CustomerJwtStrategy],
    controllers: [CustomersController, StorageFilesController, MoviesController, TheatersController]
})
export class AppModule {}
