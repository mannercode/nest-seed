import { Module } from '@nestjs/common'
import {
    BookingClient,
    PurchaseClient,
    RecommendationClient,
    ShowtimeCreationClient
} from 'apps/applications'
import { CustomersClient, MoviesClient, PurchaseRecordsClient, TheatersClient } from 'apps/cores'
import { AssetsClient } from 'apps/infrastructures'
import { CommonModule } from 'shared'
import {
    AssetsController,
    BookingController,
    CustomerJwtStrategy,
    CustomerLocalStrategy,
    CustomersController,
    MoviesController,
    PurchasesController,
    ShowtimeCreationController,
    TheatersController
} from './controllers'
import { HealthModule } from './modules'

@Module({
    imports: [CommonModule, HealthModule],
    providers: [
        CustomerLocalStrategy,
        CustomerJwtStrategy,
        CustomersClient,
        AssetsClient,
        MoviesClient,
        TheatersClient,
        ShowtimeCreationClient,
        BookingClient,
        PurchaseRecordsClient,
        RecommendationClient,
        PurchaseClient
    ],
    controllers: [
        CustomersController,
        AssetsController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController,
        BookingController,
        PurchasesController
    ]
})
export class GatewayModule {}
