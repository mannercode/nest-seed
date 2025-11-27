import { Module } from '@nestjs/common'
import {
    BookingClient,
    PurchaseClient,
    RecommendationClient,
    ShowtimeCreationClient
} from 'apps/applications'
import { CustomersClient, MoviesClient, PurchaseRecordsClient, TheatersClient } from 'apps/cores'
import { AttachmentsClient } from 'apps/infrastructures'
import { CommonModule } from 'shared'
import {
    AttachmentsController,
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
        AttachmentsClient,
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
        AttachmentsController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController,
        BookingController,
        PurchasesController
    ]
})
export class GatewayModule {}
