import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'
import { BullModule, ConfigModule, LoggerModule, MongooseModule, RedisModule } from './modules'
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

@Module({
    imports: [
        LoggerModule,
        MongooseModule,
        RedisModule,
        BullModule,
        ConfigModule,
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
    ],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class ServicesModule {}
