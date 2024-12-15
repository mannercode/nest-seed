import { Module } from '@nestjs/common'
import { ShowtimesModule, TheatersModule, TicketHoldingModule, TicketsModule } from 'services/cores'
import { BookingService } from './booking.service'

@Module({
    imports: [ShowtimesModule, TheatersModule, TicketHoldingModule, TicketsModule],
    providers: [BookingService],
    exports: [BookingService]
})
export class BookingModule {}
