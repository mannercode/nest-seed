import { Module } from '@nestjs/common'
import { BookingModule, RecommendationModule, ShowtimeCreationModule } from 'services/applications'
import {
    CustomersModule,
    MoviesModule,
    PurchasesModule,
    ShowtimesModule,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule,
    WatchRecordsModule
} from 'services/core'
import { PaymentsModule, StorageFilesModule } from 'services/infra'
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
        PurchasesModule
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
