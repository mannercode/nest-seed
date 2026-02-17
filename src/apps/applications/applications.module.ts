import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import Redis from 'ioredis'
import { CommonModule, getProjectId, RedisConfigModule } from 'shared'
import { HealthModule } from './modules'
import {
    BookingModule,
    PurchaseModule,
    RecommendationModule,
    ShowtimeCreationModule
} from './services'
import type { QueueOptions } from 'bullmq'

@Module({
    imports: [
        CommonModule,
        RedisConfigModule,
        HealthModule,
        BullModule.forRootAsync('queue', {
            useFactory: (redis: Redis) => ({
                prefix: `{queue:${getProjectId()}}`,
                connection: redis as unknown as QueueOptions['connection']
            }),
            inject: [RedisConfigModule.moduleName]
        }),
        ShowtimeCreationModule,
        RecommendationModule,
        BookingModule,
        PurchaseModule
    ]
})
export class ApplicationsModule {}
