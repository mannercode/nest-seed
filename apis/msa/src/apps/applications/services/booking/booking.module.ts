import { Module } from '@nestjs/common'
import {
    CustomerJwtAuthGuard,
    ShowtimesClient,
    TheatersClient,
    TicketHoldingClient,
    TicketsClient
} from 'cores'
import { BookingHttpController } from './booking.http-controller'
import { BookingService } from './booking.service'

@Module({
    controllers: [BookingHttpController],
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
