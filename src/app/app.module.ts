import { Module } from '@nestjs/common'
import { CustomersModule } from 'services/customers'
import { StorageFilesModule } from 'services/storage-files'
import { CustomersController, MoviesController, StorageFilesController } from './controllers'
import { CustomerJwtStrategy, CustomerLocalStrategy } from './controllers/guards'
import { CoreModule } from './core'
import { MoviesModule } from 'services/movies'

@Module({
    imports: [CoreModule, CustomersModule, StorageFilesModule, MoviesModule],
    providers: [CustomerLocalStrategy, CustomerJwtStrategy],
    controllers: [CustomersController, StorageFilesController, MoviesController]
})
export class AppModule {}
