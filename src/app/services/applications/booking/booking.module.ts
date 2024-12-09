import { Module } from '@nestjs/common'
import { ShowtimesModule, TheatersModule, TicketHoldingModule, TicketsModule } from 'services/core'
import { BookingService } from './booking.service'

@Module({
    imports: [ShowtimesModule, TheatersModule, TicketHoldingModule, TicketsModule],
    providers: [BookingService],
    exports: [BookingService]
})
export class BookingModule {}
