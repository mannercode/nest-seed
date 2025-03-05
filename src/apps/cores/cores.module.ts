import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'
import { CommonConfigModule, MongooseConfigModule, RedisConfigModule } from 'shared/modules'
import { HealthModule } from './modules'
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
        CommonConfigModule,
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
        PurchasesModule
    ],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class CoresModule {}
