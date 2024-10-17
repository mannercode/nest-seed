import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { CustomersModule } from 'services/customers'
import { MoviesModule } from 'services/movies'
import { ShowtimesModule } from 'services/showtimes'
import { StorageFilesModule } from 'services/storage-files'
import { TheatersModule } from 'services/theaters'
import { TicketsModule } from 'services/tickets'
import {
    CustomersController,
    MoviesController,
    StorageFilesController,
    TheatersController
} from './controllers'
import { CustomerJwtStrategy, CustomerLocalStrategy } from './controllers/guards'
import { CoreModule } from './core'
import { MulterConfigService } from './multer-config.service'

@Module({
    imports: [
        CoreModule,
        MulterModule.registerAsync({ useClass: MulterConfigService }),
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
