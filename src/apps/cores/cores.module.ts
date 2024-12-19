import { Module } from '@nestjs/common'
import { Modules } from './modules'
import {
    CustomersModule,
    MoviesModule,
    PurchasesModule,
    ShowtimesModule,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule,
    WatchRecordsModule
} from './services'

@Module({
    imports: [
        Modules,
        CustomersModule,
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        TicketHoldingModule,
        WatchRecordsModule,
        PurchasesModule
    ]
})
export class CoresModule {}
