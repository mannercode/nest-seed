import { Module } from '@nestjs/common'
import {
    BookingService,
    CustomersService,
    HealthService,
    MoviesService,
    PurchaseProcessService,
    PurchasesService,
    RecommendationService,
    ShowtimeCreationService,
    StorageFilesService,
    TheatersService
} from 'proxy'
import {
    BookingController,
    CustomerJwtStrategy,
    CustomerLocalStrategy,
    CustomersController,
    HealthController,
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
        PurchaseProcessService,
        HealthService
    ],
    controllers: [
        CustomersController,
        StorageFilesController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController,
        BookingController,
        PurchasesController,
        HealthController
    ]
})
export class GatewayModule {}
