import { Module } from '@nestjs/common'
import { Modules } from './modules'
import {
    BookingModule,
    PurchaseProcessModule,
    RecommendationModule,
    ShowtimeCreationModule
} from './services'

@Module({
    imports: [
        Modules,
        ShowtimeCreationModule,
        RecommendationModule,
        BookingModule,
        PurchaseProcessModule
    ]
})
export class ApplicationsModule {}
