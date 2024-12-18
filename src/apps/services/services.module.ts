import { Module } from '@nestjs/common'
import {
    BookingModule,
    PurchaseProcessModule,
    RecommendationModule,
    ShowtimeCreationModule
} from './applications'
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
import { Modules } from './modules'

@Module({
    imports: [
        Modules,
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
