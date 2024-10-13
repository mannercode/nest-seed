import { Module } from '@nestjs/common'
import { CustomersModule } from 'services/customers'
import { StorageFilesModule } from 'services/storage-files'
import {
    CustomersController,
    MoviesController,
    StorageFilesController,
    TheatersController
} from './controllers'
import { CustomerJwtStrategy, CustomerLocalStrategy } from './controllers/guards'
import { CoreModule } from './core'
import { MoviesModule } from 'services/movies'
import { TheatersModule } from 'services/theaters'

@Module({
    imports: [CoreModule, CustomersModule, StorageFilesModule, MoviesModule, TheatersModule],
    providers: [CustomerLocalStrategy, CustomerJwtStrategy],
    controllers: [CustomersController, StorageFilesController, MoviesController, TheatersController]
})
export class AppModule {}
