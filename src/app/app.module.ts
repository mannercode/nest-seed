import { Module } from '@nestjs/common'
import { CustomersModule } from 'services/customers'
import { StorageFilesModule } from 'services/storage-files'
import { CustomersController, StorageFilesController } from './controllers'
import { CustomerJwtStrategy, CustomerLocalStrategy } from './controllers/guards'
import { CoreModule } from './core'

@Module({
    imports: [CoreModule, CustomersModule, StorageFilesModule],
    providers: [CustomerLocalStrategy, CustomerJwtStrategy],
    controllers: [CustomersController, StorageFilesController]
})
export class AppModule {}
