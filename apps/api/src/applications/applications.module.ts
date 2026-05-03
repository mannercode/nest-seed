import { Module } from '@nestjs/common'
import { CommonModule } from 'config'
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
        ShowtimeCreationModule,
        RecommendationModule,
        BookingModule,
        PurchaseModule
    ]
})
export class ApplicationsModule {}
