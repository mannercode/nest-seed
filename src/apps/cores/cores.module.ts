import { Module } from '@nestjs/common'
import { CommonModule, MongooseConfigModule, RedisConfigModule } from 'shared'
import { HealthModule } from './modules'
import {
    CustomersModule,
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
        RedisConfigModule,
        MongooseConfigModule,
        HealthModule,
        CustomersModule,
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
