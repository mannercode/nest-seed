import { Module } from '@nestjs/common'
import {
    BookingService,
    CustomersService,
    MoviesService,
    PurchaseProcessService,
    PurchasesService,
    RecommendationService,
    ShowtimeCreationService,
    StorageFilesService,
    TheatersService
} from 'services'
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
import { CoreModule } from './core'

@Module({
    imports: [CoreModule],
    providers: [
        CustomerLocalStrategy,
        CustomerJwtStrategy,
        CustomersService,
        StorageFilesService,
        MoviesService,
        TheatersService,
        ShowtimeCreationService,
        BookingService,
        PurchasesService,
        RecommendationService,
        PurchaseProcessService
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
