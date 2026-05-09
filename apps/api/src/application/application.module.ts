import { Module } from '@nestjs/common'
import { BookingModule } from './booking'
import { PurchaseModule } from './purchase'
import { RecommendationModule } from './recommendation'
import { ShowtimeCreationModule } from './showtime-creation'

// GlobalModule 은 @Global 이라 여기 나열할 필요 없음.
@Module({
    exports: [BookingModule, PurchaseModule, RecommendationModule, ShowtimeCreationModule],
    imports: [ShowtimeCreationModule, RecommendationModule, BookingModule, PurchaseModule]
})
export class ApplicationModule {}
