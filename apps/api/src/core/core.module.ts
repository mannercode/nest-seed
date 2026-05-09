import { Module } from '@nestjs/common'
import { MoviesModule } from './movies'
import { PurchaseRecordsModule } from './purchase-records'
import { ShowtimesModule } from './showtimes'
import { TheatersModule } from './theaters'
import { TicketHoldingModule } from './ticket-holding'
import { TicketsModule } from './tickets'
import { UsersModule } from './users'
import { WatchRecordsModule } from './watch-records'

// GlobalModule 은 @Global 이라 여기 나열할 필요 없음.
@Module({
    imports: [
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
export class CoreModule {}
