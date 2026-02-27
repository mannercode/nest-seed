import { Module } from '@nestjs/common'
import { TemporalClientModule } from 'common'
import { AppConfigService, CommonModule, RedisConfigModule } from 'shared'
import { HealthModule, TemporalWorkerModule } from './modules'
import {
    BookingModule,
    PurchaseModule,
    RecommendationModule,
    ShowtimeCreationModule
} from './services'

@Module({
    imports: [
        CommonModule,
        RedisConfigModule,
        HealthModule,
        TemporalClientModule.registerAsync({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => config.temporal
        }),
        ShowtimeCreationModule,
        RecommendationModule,
        BookingModule,
        PurchaseModule,
        TemporalWorkerModule
    ]
})
export class ApplicationsModule {}
