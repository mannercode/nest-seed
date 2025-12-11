import { Module } from '@nestjs/common'
import {
    BookingClient,
    MovieDraftsClient,
    PurchaseClient,
    RecommendationClient,
    ShowtimeCreationClient
} from 'apps/applications'
import { CustomersClient, MoviesClient, PurchaseRecordsClient, TheatersClient } from 'apps/cores'
import { AssetsClient } from 'apps/infrastructures'
import { CommonModule } from 'shared'
import {
    BookingController,
    MovieDraftsController,
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
        PurchaseClient,
        MovieDraftsClient
    ],
    controllers: [
        CustomersController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController,
        BookingController,
        PurchasesController,
        MovieDraftsController
    ]
})
export class GatewayModule {}
