import { TemporalClientModule } from '@mannercode/microservices'
import { Module } from '@nestjs/common'
import { AppConfigService, CommonModule, RedisConfigModule } from 'config'
import { HealthModule, TemporalWorkerModule } from './modules'
import {
    BookingModule,
    PurchaseModule,
    RecommendationHttpModule,
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
        RecommendationHttpModule,
        BookingModule,
        PurchaseModule,
        TemporalWorkerModule
    ]
})
export class ApplicationsModule {}
