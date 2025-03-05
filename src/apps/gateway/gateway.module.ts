import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import {
    BookingProxy,
    PurchaseProcessProxy,
    RecommendationProxy,
    ShowtimeCreationProxy
} from 'applications'
import { CustomersProxy, MoviesProxy, PurchasesProxy, TheatersProxy } from 'cores'
import { StorageFilesProxy } from 'infrastructures'
import { CommonConfigModule } from 'shared/modules'
import {
    BookingController,
    CustomerJwtStrategy,
    CustomerLocalStrategy,
    CustomersController,
    MoviesController,
    PurchasesController,
    ShowtimeCreationController,
    StorageFilesController,
    TheatersController
} from './controllers'
import { HealthModule, MulterConfigService, PipesModule } from './modules'

@Module({
    imports: [
        CommonConfigModule,
        HealthModule,
        PipesModule,
        MulterModule.registerAsync({ useClass: MulterConfigService })
    ],
    providers: [
        CustomerLocalStrategy,
        CustomerJwtStrategy,
        CustomersProxy,
        StorageFilesProxy,
        MoviesProxy,
        TheatersProxy,
        ShowtimeCreationProxy,
        BookingProxy,
        PurchasesProxy,
        RecommendationProxy,
        PurchaseProcessProxy
    ],
    controllers: [
        CustomersController,
        StorageFilesController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController,
        BookingController,
        PurchasesController
    ]
})
export class GatewayModule {}
