import { Module } from '@nestjs/common'
import { ShowtimesProxy, TheatersProxy, TicketHoldingProxy, TicketsProxy } from 'cores'
import { BookingController } from './booking.controller'
import { BookingService } from './booking.service'

@Module({
    providers: [BookingService, ShowtimesProxy, TheatersProxy, TicketHoldingProxy, TicketsProxy],
    controllers: [BookingController],
    exports: [BookingService]
})
export class BookingModule {}
