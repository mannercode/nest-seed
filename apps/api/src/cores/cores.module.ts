import { Module } from '@nestjs/common'
import { CommonModule } from 'config'
import {
    UsersModule,
    MoviesModule,
    PurchaseRecordsModule,
    ShowtimesModule,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule,
    WatchRecordsModule
} from './services'

@Module({
    imports: [
        CommonModule,
        UsersModule,
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        TicketHoldingModule,
        WatchRecordsModule,
        PurchaseRecordsModule
    ],
    exports: [
        UsersModule,
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        TicketHoldingModule,
        WatchRecordsModule,
        PurchaseRecordsModule
    ]
})
export class CoresModule {}
