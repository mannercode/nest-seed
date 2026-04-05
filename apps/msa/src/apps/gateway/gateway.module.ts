import { Module } from '@nestjs/common'
import {
    BookingClient,
    PurchaseClient,
    RecommendationClient,
    ShowtimeCreationClient
} from 'applications'
import { CommonModule } from 'config'
import { CustomersClient, MoviesClient, PurchaseRecordsClient, TheatersClient } from 'cores'
import {
    BookingHttpController,
    CustomerJwtAuthGuard,
    CustomerLocalAuthGuard,
    CustomerOptionalJwtAuthGuard,
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
        CustomerJwtAuthGuard,
        CustomerLocalAuthGuard,
        CustomerOptionalJwtAuthGuard,
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
