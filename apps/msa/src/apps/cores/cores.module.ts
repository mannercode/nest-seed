import { Module } from '@nestjs/common'
import { CommonModule, MongooseConfigModule, RedisConfigModule } from 'config'
import { HealthModule } from './modules'
import {
    CustomersModule,
    MoviesHttpModule,
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
        MoviesHttpModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        TicketHoldingModule,
        WatchRecordsModule,
        PurchaseRecordsModule
    ]
})
export class CoresModule {}
