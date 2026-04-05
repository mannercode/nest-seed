import { Module } from '@nestjs/common'
import { ShowtimesClient, TheatersClient, TicketHoldingClient, TicketsClient } from 'apps/cores'
import { BookingController } from './booking.controller'
import { BookingService } from './booking.service'

@Module({
    controllers: [BookingController],
    providers: [BookingService, ShowtimesClient, TheatersClient, TicketHoldingClient, TicketsClient]
})
export class BookingModule {}
