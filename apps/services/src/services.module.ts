import { Module } from '@nestjs/common'
import {
    BookingModule,
    PurchaseProcessModule,
    RecommendationModule,
    ShowtimeCreationModule
} from './applications'
import { CoreModule } from './core'
import {
    CustomersModule,
    MoviesModule,
    PurchasesModule,
    ShowtimesModule,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule,
    WatchRecordsModule
} from './cores'
import { HealthModule, PaymentsModule, StorageFilesModule } from './infrastructures'

@Module({
    imports: [
        CoreModule,
        CustomersModule,
        HealthModule,
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
    ]
})
export class ServicesModule {}
