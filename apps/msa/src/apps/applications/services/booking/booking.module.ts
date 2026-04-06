import { Module } from '@nestjs/common'
import {
    CustomerJwtAuthGuard,
    ShowtimesClient,
    TheatersClient,
    TicketHoldingClient,
    TicketsClient
} from 'cores'
import { BookingController } from './booking.controller'
import { BookingHttpController } from './booking.http-controller'
import { BookingService } from './booking.service'

@Module({
    controllers: [BookingController, BookingHttpController],
    providers: [
        BookingService,
        ShowtimesClient,
        TheatersClient,
        TicketHoldingClient,
        TicketsClient,
        CustomerJwtAuthGuard
    ]
})
export class BookingModule {}
