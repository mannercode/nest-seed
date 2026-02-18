import { Module } from '@nestjs/common'
import {
    BookingClient,
    PurchaseClient,
    RecommendationClient,
    ShowtimeCreationClient
} from 'apps/applications'
import { CustomersClient, MoviesClient, PurchaseRecordsClient, TheatersClient } from 'apps/cores'
import { CommonModule } from 'shared'
import {
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
    controllers: [
        CustomersController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController,
        BookingController,
        PurchasesController
    ],
    imports: [CommonModule, HealthModule],
    providers: [
        CustomerLocalStrategy,
        CustomerJwtStrategy,
        CustomersClient,
        MoviesClient,
        TheatersClient,
        ShowtimeCreationClient,
        BookingClient,
        PurchaseRecordsClient,
        RecommendationClient,
        PurchaseClient
    ]
})
export class GatewayModule {}
