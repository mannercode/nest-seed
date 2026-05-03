import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { QueueOptions } from 'bullmq'
import { CommonModule, getProjectId, RedisConfigModule } from 'config'
import Redis from 'ioredis'
import {
    BookingModule,
    PurchaseModule,
    RecommendationModule,
    ShowtimeCreationModule
} from './services'

@Module({
    exports: [BookingModule, PurchaseModule, RecommendationModule, ShowtimeCreationModule],
    imports: [
        CommonModule,
        RedisConfigModule,
        BullModule.forRootAsync('queue', {
            inject: [RedisConfigModule.moduleName],
            useFactory: (redis: Redis) => ({
                connection: redis as QueueOptions['connection'],
                prefix: `{queue:${getProjectId()}}`
            })
        }),
        ShowtimeCreationModule,
        RecommendationModule,
        BookingModule,
        PurchaseModule
    ]
})
export class ApplicationsModule {}
