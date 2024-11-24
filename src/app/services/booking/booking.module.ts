import { Module } from '@nestjs/common'
import { ShowtimesModule } from 'services/showtimes'
import { TheatersModule } from 'services/theaters'
import { TicketHoldingModule } from 'services/ticket-holding'
import { TicketsModule } from 'services/tickets'
import { BookingService } from './booking.service'

@Module({
    imports: [ShowtimesModule, TheatersModule, TicketHoldingModule, TicketsModule],
    providers: [BookingService],
    exports: [BookingService]
})
export class BookingModule {}
