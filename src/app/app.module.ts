import { Module } from '@nestjs/common'
import {
    BookingModule,
    PurchaseProcessModule,
    RecommendationModule,
    ShowtimeCreationModule
} from 'services/applications'
import {
    CustomersModule,
    MoviesModule,
    PurchasesModule,
    ShowtimesModule,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule,
    WatchRecordsModule
} from 'services/cores'
import { PaymentsModule, StorageFilesModule } from 'services/infrastructures'
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
    imports: [
        CoreModule,
        CustomersModule,
        StorageFilesModule,
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        ShowtimeCreationModule,
        TicketHoldingModule,
        WatchRecordsModule,
        RecommendationModule,
        BookingModule,
        PaymentsModule,
        PurchasesModule,
        PurchaseProcessModule
    ],
    providers: [CustomerLocalStrategy, CustomerJwtStrategy],
    controllers: [
        HealthController,
        CustomersController,
        StorageFilesController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController,
        BookingController,
        PurchasesController
    ]
})
export class AppModule {}
