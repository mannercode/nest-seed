import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import Redis from 'ioredis'
import { CommonModule, getProjectId, RedisConfigModule } from 'shared'
import { HealthModule } from './modules'
import {
    BookingModule,
    MovieDraftsModule,
    PurchaseModule,
    RecommendationModule,
    ShowtimeCreationModule
} from './services'

@Module({
    imports: [
        CommonModule,
        RedisConfigModule,
        HealthModule,
        BullModule.forRootAsync('queue', {
            useFactory: (redis: Redis) => ({
                prefix: `{queue:${getProjectId()}}`,
                connection: redis
            }),
            inject: [RedisConfigModule.moduleName]
        }),
        ShowtimeCreationModule,
        RecommendationModule,
        BookingModule,
        PurchaseModule,
        MovieDraftsModule
    ]
})
export class ApplicationsModule {}
