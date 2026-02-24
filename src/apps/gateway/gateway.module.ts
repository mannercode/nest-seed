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
    BookingHttpController,
    CustomerJwtStrategy,
    CustomerLocalStrategy,
    CustomersHttpController,
    MoviesHttpController,
    PurchaseHttpController,
    ShowtimeCreationHttpController,
    TheatersHttpController
} from './controllers'
import { HealthModule } from './modules'

@Module({
    controllers: [
        CustomersHttpController,
        MoviesHttpController,
        TheatersHttpController,
        ShowtimeCreationHttpController,
        BookingHttpController,
        PurchaseHttpController
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
