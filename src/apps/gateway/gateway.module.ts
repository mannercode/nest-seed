import { Module } from '@nestjs/common'
import {
    BookingProxy,
    PurchaseProcessProxy,
    RecommendationProxy,
    ShowtimeCreationProxy
} from 'applications'
import { CustomersProxy, MoviesProxy, PurchasesProxy, TheatersProxy } from 'cores'
import { StorageFilesProxy } from 'infrastructures'
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
import { Modules } from './modules'

@Module({
    imports: [Modules],
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
